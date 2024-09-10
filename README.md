# Demo accounts for TRAIT wallet

## Assets

The repo contains assets for demo account in TRAIT wallet:

- metadadata of blockchain entities (AppAgents, fungible tokens, NFT Collections, NFT Tokens);
- corresponding images;

These assets are automatically deployed to AWS S3 bucket via GitHub CI workflow.
Then assets become available via CDN on `https://trait-wallet-demo-account.trait.tech`.

## Code

This repo also contains the JS code to automatically create AppAgents & Tokens and persist the metadata into the TRAIT blockchain.
This is a good example of programmatical creation of assets in the TRAIT blockchain.
