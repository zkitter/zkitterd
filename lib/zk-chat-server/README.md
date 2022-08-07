# zkchat

zkchat is a lightweight library providing tools for building an end-to-end encrypted chat using RLN zero-knowledge proof.

## Overview
zkchat consists of 3 layers: identity, encryption, and RLN.

### Identity
A user identity is represented by the following data:

```json 
{
  "ecdh_pubkey": "0x123...",
  "identity_commitment": "0x123...",
  "address": "0x123" 
}
```

To make user recovery easier, `ecdh_pubkey` and `identity_commitment` should be derived from a common secret, that way the user need not to back up multiple secrets.

#### ECDH derivation
1. signing the message `"signing for ecdh with nonce 0"` with some private key, such the using `eth.personal.sign`
2. produce a sha256 hash of the signature from #1
3. the 32-bit hash from #2 is the derived private key

#### Identity Commitment Derivation
Please refer to [@zk-kit/identity](https://www.npmjs.com/package/@zk-kit/identity) for how to create an identity with a message strategy 

#### Anonymous user consideration
Some user from trusted ZK groups (e.g. Interep) can send message without registering with their ETH address. In that case, we can derive their ECDH by:
1. produce a sha256 hash of their ZKIdentity nullifier + trapdoor
2. produce a sha256 hash of the resulting hash from #1
3. the 32-bit hash from #2 is the derived private key

### Encryption
There are a few encryption scheme depending on the type of conversation.

#### Bob (known user) to Alice (known user) DM
1. Bob retrieve ECDH pubkey of Alice from user registry
2. Bob derived Diffie-Hellman shared secret using Alice's pubkey and his private key
3. Bob can then use the shared secret to encrypt/decrypt messages from this conversation

#### Bob (anon user) to Alice (known user) DM
1. Bob first generate a random 32-bit hash
2. Bob derive a new ECDH by signing the random hash from #1
3. Bob must include the random hash + resulting ecdh pubkey to Alice
4. Alice can derive DH shared secret because she can retrieve the anon's ECDH pubkey from the message
5. Bob can derive DH shared secret by retrieving the random hash from message and repeating step #2 + #3\
6. Note that if Bob compromised his identity to Alice in this conversation, it would not exposed his other anon chats, as the pubkey used is conversation-specific

#### Bob (any user) to a Public Room (unimplemented)
Public room messages are unencrypted

#### Bob (any user) to a Private Room (unimplemented)
Encryption scheme for private room is still undecided. We know that it will at least use a pairwise channel for each members of the chat room to share secret among the memebers whenever membership changed.

A further optimization can be to use Diffie-Hellman tree to decrease number of pairwise communication after each membership change (only the members involved in the merkle path of the updated member need to be notified) 

### RLN
Instead of sending messages from a wallet address, users can also attach an RLN proof to chat anonymously. An RLN proof allows users to chat anonymously be default, but if the sender send too many messages within a period of time, their id commitment will be revealed and banned.

zkchat provides a base functionality to support the following groups:
- one of any users: user can attest that their message comes from one of any zkchat users
- one of any interep groups: user can attest that their messages come from any one of interep's OAuth group

Depending on the application, zkchat also provide a way for adding support for a new group easily.
