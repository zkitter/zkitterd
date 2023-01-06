import { calculateReputation, OAuthProvider, ReputationLevel } from '@interep/reputation';
import { Strategy as RedditStrategy } from '@r1oga/passport-reddit';
import { Strategy as GhStrategy } from 'passport-github2';
import { Strategy as TwitterStrategy } from 'passport-twitter';

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
  twConsumerKey,
  twConsumerSecret,
} = config;

export const STRATEGIES = {
  [OAuthProvider.GITHUB]: {
    options: {
      callbackURL: ghCallbackUrl,
      clientID: ghClientId,
      clientSecret: ghClientSecret,
    },
    scope: ['read:user', 'read:org'],
    Strategy: GhStrategy,
  },
  [OAuthProvider.REDDIT]: {
    options: {
      callbackURL: rdCallbackUrl,
      clientID: rdClientId,
      clientSecret: rdClientSecret,
    },
    scope: ['identity'],
    Strategy: RedditStrategy,
  },
  [OAuthProvider.TWITTER]: {
    options: {
      callbackURL: twCallbackUrl,
      consumerKey: twConsumerKey,
      consumerSecret: twConsumerSecret,
    },
    scope: ['tweet.read', 'users.read', 'offline.access', 'follows.read'],
    Strategy: TwitterStrategy,
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
        _json: {
          followers,
          plan: { name: planName },
        },

        id: userId,
        username,
      } = profile as GhProfile;

      const proPlan = planName === 'pro';
      const receivedStars = await getReceivedStars(username);
      const reputation = calculateReputation(OAuthProvider.GITHUB, {
        followers,
        proPlan,
        receivedStars,
      });

      return { reputation, userId, username };
    }

    case OAuthProvider.REDDIT: {
      const {
        _json: {
          coins,
          has_subscribed_to_premium: premiumSubscription,
          linked_identities,
          total_karma: karma,
        },
        id: userId,
        name: username,
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
