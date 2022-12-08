import { Strategy as GhStrategy } from 'passport-github2';
import { Strategy as RedditStrategy } from '@r1oga/passport-reddit';
import { Strategy as TwitterStrategy } from '@superfaceai/passport-twitter-oauth2';
import { calculateReputation, OAuthProvider, ReputationLevel } from '@interep/reputation';

import config from './config';
import { getReceivedStars } from './github';
import { getBotometerScore, getTwitterUserMetrics } from './twitter';

const {
  ghCallbackUrl,
  ghClientId,
  ghClientSecret,
  rdCallbackUrl,
  rdClientId,
  rdClientSecret,
  twCallbackUrl,
  twClientId,
  twClientSecret,
} = config;

export const STRATEGIES = {
  [OAuthProvider.GITHUB]: {
    Strategy: GhStrategy,
    options: {
      clientID: ghClientId,
      clientSecret: ghClientSecret,
      callbackURL: ghCallbackUrl,
    },
    scope: ['read:user', 'read:org'],
  },
  [OAuthProvider.REDDIT]: {
    Strategy: RedditStrategy,
    options: {
      clientID: rdClientId,
      clientSecret: rdClientSecret,
      callbackURL: rdCallbackUrl,
    },
    scope: ['identity'],
  },
  [OAuthProvider.TWITTER]: {
    // @ts-ignore
    Strategy: TwitterStrategy,
    options: {
      clientType: 'public',
      clientID: twClientId,
      clientSecret: twClientSecret,
      callbackURL: twCallbackUrl,
    },
    scope: ['tweet.read', 'users.read', 'offline.access', 'follows.read'],
  },
};

export type GhProfile = {
  id: string;
  provider: OAuthProvider;
  username: string;
  _json: {
    followers: number;
    plan: { name: string };
  };
};

export type TwProfile = {
  id: string;
  provider: OAuthProvider;
  username: string;
};

export type RdProfile = {
  id: string;
  name: string;
  provider: OAuthProvider;
  _json: {
    coins: number;
    has_subscribed_to_premium: boolean;
    linked_identities: any[];
    total_karma: number;
  };
};

type ProfileParams = {
  reputation: ReputationLevel;
  userId: string;
  username: string;
};

export const getProfileParams = async (
  profile: GhProfile | RdProfile | TwProfile,
  provider: OAuthProvider
): Promise<ProfileParams> => {
  switch (provider) {
    case OAuthProvider.GITHUB: {
      const {
        id: userId,

        username,
        _json: {
          followers,
          plan: { name: planName },
        },
      } = profile as GhProfile;

      const proPlan = planName === 'pro';
      const receivedStars = await getReceivedStars(username);
      const reputation = calculateReputation(OAuthProvider.GITHUB, {
        followers,
        receivedStars,
        proPlan,
      });

      return { reputation, userId, username };
    }

    case OAuthProvider.REDDIT: {
      const {
        id: userId,
        name: username,
        _json: {
          coins,
          has_subscribed_to_premium: premiumSubscription,
          linked_identities,
          total_karma: karma,
        },
      } = profile as RdProfile;

      const reputation = calculateReputation(OAuthProvider.REDDIT, {
        coins,
        karma,
        linkedIdentities: linked_identities.length,
        premiumSubscription,
      });

      return { reputation, userId, username };
    }

    case OAuthProvider.TWITTER: {
      const { id: userId, username } = profile as TwProfile;

      const { followers, verifiedProfile } = await getTwitterUserMetrics(userId);
      const botometerOverallScore = await getBotometerScore(username);

      const reputation = calculateReputation(OAuthProvider.TWITTER, {
        botometerOverallScore,
        followers,
        verifiedProfile,
      });

      return { reputation, userId, username };
    }
  }
};
