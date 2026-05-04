# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.230.4](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.230.3...v1.230.4) (2026-05-04)


### Bug Fixes

* update railpack.json to improve npmrc handling and streamline install commands ([3e929e4](https://github.com/paperlesspaper/paperlesspaper-web/commit/3e929e49d34c3da20098476c4fd9f020b346c815))





## [1.230.3](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.230.2...v1.230.3) (2026-05-04)


### Bug Fixes

* update .npmrc file path in nixpacks and railpack configurations ([801784e](https://github.com/paperlesspaper/paperlesspaper-web/commit/801784e13807166da99e2e21ffb163fcbf187ac8))





## [1.230.2](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.230.1...v1.230.2) (2026-05-04)


### Bug Fixes

* update npmrc file handling in nixpacks for consistent installation ([b4f63c7](https://github.com/paperlesspaper/paperlesspaper-web/commit/b4f63c76cd6b4d23b70c61ef1dbd80738b7d6064))





## [1.230.1](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.230.0...v1.230.1) (2026-05-04)


### Bug Fixes

* update node engine requirement to 24 in nixpacks and .nvmrc ([683f70e](https://github.com/paperlesspaper/paperlesspaper-web/commit/683f70e4d09c529b2c3a7b0661c574cf11a6b157))





# [1.230.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.229.0...v1.230.0) (2026-05-04)


### Bug Fixes

* add type to INIT message in iframe communication for PhotoFrame component ([a8f9d89](https://github.com/paperlesspaper/paperlesspaper-web/commit/a8f9d8980976aa002c17382c9798b9333aed90e1))
* align OpenIntegration settings iframe INIT message format with server render format ([05d62aa](https://github.com/paperlesspaper/paperlesspaper-web/commit/05d62aae257ee240debd7692458be1a47dfa1735))
* enhance cronjobPapers to accept job parameter and add dynamic-integration action ([e6e435d](https://github.com/paperlesspaper/paperlesspaper-web/commit/e6e435d2e1237f9cb823c9ddfa6dd78a62027d3b))
* ensure BullMQ starts correctly in production and refactor page navigation in render service ([8d72516](https://github.com/paperlesspaper/paperlesspaper-web/commit/8d72516a737f9650b2c988d9d0e24fc3a89b6a4f))
* include type in postMessage for Google Calendar integration ([9fc80e6](https://github.com/paperlesspaper/paperlesspaper-web/commit/9fc80e6e08d89b10299d4ef8f8de970d8652bf5b))
* increase DEVICE_BATCH_SIZE for improved device processing in cronjob ([1769443](https://github.com/paperlesspaper/paperlesspaper-web/commit/1769443d6d51efae4497138f9e67a4a2bf07736c))
* reduce DEVICE_BATCH_SIZE for optimized device processing in cronjob ([0bfd3c2](https://github.com/paperlesspaper/paperlesspaper-web/commit/0bfd3c2b78729cef55d634635577884aa27bb558))
* streamline cronjob initialization and update image generation logic ([3174ca0](https://github.com/paperlesspaper/paperlesspaper-web/commit/3174ca0c106fd15320acfb4bf9438c7dc4e1d755))
* update node engine requirement and enhance OpenIntegrationEditor with empty state handling ([8a49904](https://github.com/paperlesspaper/paperlesspaper-web/commit/8a49904c3a5a10181b766587698c1e74c3019de8))
* update node engine requirement to 24 and bump @internetderdinge/api version to 1.229.28 ([a0ffb4f](https://github.com/paperlesspaper/paperlesspaper-web/commit/a0ffb4f3879214021d294d0ce8104c28d44a0a1f))
* update papers cronjob to increase DEVICE_BATCH_SIZE and adjust upsertEvery interval ([3d797ac](https://github.com/paperlesspaper/paperlesspaper-web/commit/3d797aced7044d5dc15462292f1c450989c5d01b))
* update PhotoFrame to use legacySelectedMeta for URL query parameters ([e8b6662](https://github.com/paperlesspaper/paperlesspaper-web/commit/e8b66622460c90011a030bbeb83a784e489311da))
* wait until all network connections finished before taking screenshot ([f07953e](https://github.com/paperlesspaper/paperlesspaper-web/commit/f07953ee55655f6efc088df39b441fda8e5e93d9))
* **web:** caddy ([2001002](https://github.com/paperlesspaper/paperlesspaper-web/commit/2001002730820ff5d59b15234668e7bbe9666b01))
* **web:** dependencies updated ([185e28f](https://github.com/paperlesspaper/paperlesspaper-web/commit/185e28f17c92f42fed6f367151282ba3e43dd9eb))
* **web:** improve console log messages for clarity in iframe communication and image uploads ([a9d4a03](https://github.com/paperlesspaper/paperlesspaper-web/commit/a9d4a03d0a0d6789b35036e7f85fb1726e23633b))
* **web:** nixpack changed ([caf1cd1](https://github.com/paperlesspaper/paperlesspaper-web/commit/caf1cd154315f67a806f26a1c3e8c61843a7b47e))
* **web:** nixpack changed ([ee4a2a8](https://github.com/paperlesspaper/paperlesspaper-web/commit/ee4a2a8fe9bf8b8e1df6e064f7cfbd5664882097))
* **web:** nixpack config ([4c759c5](https://github.com/paperlesspaper/paperlesspaper-web/commit/4c759c55c3a86ae6534a59b1e0e46b7e618e8f33))
* **web:** nixpack config updated ([89df1f7](https://github.com/paperlesspaper/paperlesspaper-web/commit/89df1f7e886497dd8508c2b292b761658fa8eedd))
* **web:** nixpack deployment ([11d0ed0](https://github.com/paperlesspaper/paperlesspaper-web/commit/11d0ed0ffa199eca2a8d35e96903987167ed8736))
* **web:** nixpack version ([b7963cd](https://github.com/paperlesspaper/paperlesspaper-web/commit/b7963cd1477df039ee70c36346eb8f39e227e8a9))
* **web:** removed orange ([3ca0c19](https://github.com/paperlesspaper/paperlesspaper-web/commit/3ca0c19953d805f27ebd281ff7173c0e51faea53))
* **web:** switch to caddy in nixpack ([c3e8512](https://github.com/paperlesspaper/paperlesspaper-web/commit/c3e851273a3e8a7d496bf9bddca226249ce70e2f))
* **web:** updating api docs ([3dd3bf7](https://github.com/paperlesspaper/paperlesspaper-web/commit/3dd3bf7bdc1db51ce4f557501d1da1863ebe9551))
* **web:** version update ([ba494af](https://github.com/paperlesspaper/paperlesspaper-web/commit/ba494aff98b9ff2800434f50fb8335acfd298dcc))


### Features

* **web:** add optional picture field to uploadSingleImageSchema and improve console log clarity in PhotoFrame ([ae4db3e](https://github.com/paperlesspaper/paperlesspaper-web/commit/ae4db3e5ff553736aafdf3e93ff1dc3f5b49043e))
* **web:** added persistent Image editor tools ([c484b41](https://github.com/paperlesspaper/paperlesspaper-web/commit/c484b4156c17820235b819287aed1e360849cac5))
* **web:** deployment config for Docker ([0bcef67](https://github.com/paperlesspaper/paperlesspaper-web/commit/0bcef67dd9fce65a8fd09d03339d849ba32332d5))
* **web:** implement mergeUrlWithQueryParams function for URL handling ([91a4733](https://github.com/paperlesspaper/paperlesspaper-web/commit/91a4733e5fc651a76f959347b7d87d963ebf0e63))
* **web:** improved colors and upload flexibility ([93ebe75](https://github.com/paperlesspaper/paperlesspaper-web/commit/93ebe75dc3cba527d9a1148eecca346be008c058))
* **web:** update CSS editor to include Callout for user guidance and improve helper text ([0c6bea5](https://github.com/paperlesspaper/paperlesspaper-web/commit/0c6bea5409996fe7b67158f67d62ab2827e33330))
* **web:** updated env simplified handler ([da1b450](https://github.com/paperlesspaper/paperlesspaper-web/commit/da1b450eb33a75a0d8ae46fb4385cffc028e640c))





# [1.229.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.228.0...v1.229.0) (2026-04-08)


### Bug Fixes

* **git:** removed hooks ([2b3d2bd](https://github.com/paperlesspaper/paperlesspaper-web/commit/2b3d2bd3498a46a24688ff48e6496174b6849665))


### Features

* **web:** switch to BullMq and updated Onboarding ([3d41594](https://github.com/paperlesspaper/paperlesspaper-web/commit/3d41594d7d5e0763c4f72dad5fa8e649826079d1))





# [1.228.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.227.1...v1.228.0) (2026-03-08)


### Features

* **package:** precommit hooks ([75b11ad](https://github.com/paperlesspaper/paperlesspaper-web/commit/75b11adb05138160e65a3ff0b0694e82e3e15ec9))
* **web:** hooks ([15c1869](https://github.com/paperlesspaper/paperlesspaper-web/commit/15c18691de615dc29c8fc47d3c4b6c37b18b3f16))
* **web:** new version ([a16facb](https://github.com/paperlesspaper/paperlesspaper-web/commit/a16facb7aea64c42d6437e3a5783c0889b805057))
* **web:** updated commit hooks ([2cebcaa](https://github.com/paperlesspaper/paperlesspaper-web/commit/2cebcaa863db3193923762f68acef50b31bb803f))





## [1.227.1](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.227.0...v1.227.1) (2026-03-08)

**Note:** Version bump only for package @paperlesspaper/app





# [1.227.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.226.1...v1.227.0) (2026-03-08)


### Features

* **packages:** release updated ([1fdb90c](https://github.com/paperlesspaper/paperlesspaper-web/commit/1fdb90ca478674f75e1f2f646319280fa61f0210))





## [1.226.1](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.226.0...v1.226.1) (2026-03-07)


### Bug Fixes

* **api:** added token to release ([1bfa0bf](https://github.com/paperlesspaper/paperlesspaper-web/commit/1bfa0bf3093778956e66190dc7a02780b4ab7e83))





# [1.226.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.225.0...v1.226.0) (2026-03-07)


### Bug Fixes

* **api:** npmrc removed from docker ([58b9607](https://github.com/paperlesspaper/paperlesspaper-web/commit/58b9607ce8e5063a271bacb9eefac79ac372f6c2))
* **api:** removed npmrc ([7992a45](https://github.com/paperlesspaper/paperlesspaper-web/commit/7992a45f2c3744ba7886e83710d9bc4d3142053e))
* **api:** workflow fixed ([ee0c9cb](https://github.com/paperlesspaper/paperlesspaper-web/commit/ee0c9cb786c2c1880fe3e15988ea509fbae7865f))


### Features

* **api:** release helpers ([9379928](https://github.com/paperlesspaper/paperlesspaper-web/commit/9379928e3cd9d4576473aab6d7f07f66855cae5a))





# 1.225.0 (2026-03-07)


### Bug Fixes

* **web:** removed lockfiles ([ea22a0e](https://github.com/paperlesspaper/paperlesspaper-web/commit/ea22a0e5dc1b5a6d162c72e42c89f01d990443a4))


### Features

* **package:** updated lock file and extraction of fontawesome to local mirror ([edef59b](https://github.com/paperlesspaper/paperlesspaper-web/commit/edef59bbbf816a6c7d7d37d4da5eecf4a2ab9f00))
* **web:** added android app ([cd4ec9a](https://github.com/paperlesspaper/paperlesspaper-web/commit/cd4ec9a54457b47eedf91d3b547225749d617f9e))
* **web:** added epaper features ([77f9fc9](https://github.com/paperlesspaper/paperlesspaper-web/commit/77f9fc9e00b3193bc2327e255415a90f561f7713))
* **web:** added fly config to repository ([bf16faa](https://github.com/paperlesspaper/paperlesspaper-web/commit/bf16faac2224605c3322e594644f0c13dfbc684e))
* **web:** added ios ([1b1d7f9](https://github.com/paperlesspaper/paperlesspaper-web/commit/1b1d7f924d74d26d0ed14f7b87fb39901acdef27))
* **web:** added missing files ([5bb7b34](https://github.com/paperlesspaper/paperlesspaper-web/commit/5bb7b3402f96336fb6d0a2e6fa5560d541308c05))
* **web:** added more ([af6f319](https://github.com/paperlesspaper/paperlesspaper-web/commit/af6f3191b7de60bffece4b7394946482c9f2e2b1))
* **web:** added more ([7ff70c3](https://github.com/paperlesspaper/paperlesspaper-web/commit/7ff70c3c05d7b30cce16f293ba35ba54b1fabf7a))
* **web:** continuing decoupling ([ed5c4cd](https://github.com/paperlesspaper/paperlesspaper-web/commit/ed5c4cd1c6dbdb55dca968484e1173aaff325e3c))
* **web:** continuing decoupling ([f8c85f4](https://github.com/paperlesspaper/paperlesspaper-web/commit/f8c85f4408c911149c46d71d12ce1497347e1be1))
* **web:** initial commit ([d1d4652](https://github.com/paperlesspaper/paperlesspaper-web/commit/d1d46527aa4ee34daee1d3616986545764ee843f))
* **web:** initial commit ([d581188](https://github.com/paperlesspaper/paperlesspaper-web/commit/d581188d25df42f5ab07c1cedd77321ab03eafa5))
* **web:** initial commit ([d1ca81b](https://github.com/paperlesspaper/paperlesspaper-web/commit/d1ca81be459cee7b5480ff59c82a768d640cef4f))
* **web:** initial commit ([e98cd85](https://github.com/paperlesspaper/paperlesspaper-web/commit/e98cd85c637f3cd25ac22cca3c786eb63fcac6cf))
* **web:** initial commit ([b214143](https://github.com/paperlesspaper/paperlesspaper-web/commit/b214143dfbcb410a2cef7928efa0f193d454d613))
* **web:** initial commit ([d512eb6](https://github.com/paperlesspaper/paperlesspaper-web/commit/d512eb6bf85547489af4de12b82929468c9b5089))
* **web:** initial commit ([db2a421](https://github.com/paperlesspaper/paperlesspaper-web/commit/db2a42132f7d360c0f78c64761c839da81fe9d2a))
* **web:** initial commits ([3a9fd1f](https://github.com/paperlesspaper/paperlesspaper-web/commit/3a9fd1fbe079c191c00caa723d3ec817a188325a))
* **web:** initial Dockerfile ([9abfaf9](https://github.com/paperlesspaper/paperlesspaper-web/commit/9abfaf98a41d4e9a3e56bac03184ee0a13b57211))
* **web:** more initial ([601d668](https://github.com/paperlesspaper/paperlesspaper-web/commit/601d66822772161d19881c71f9d783dd09b14c94))
* **web:** update versions ([077ebee](https://github.com/paperlesspaper/paperlesspaper-web/commit/077ebee383865e8410aa2bc95469cb41a3001838))
* **web:** updated gitignore ([954fb8d](https://github.com/paperlesspaper/paperlesspaper-web/commit/954fb8d9f3986706bdd5080f5ee0e80fe571e7bc))
* **web:** updated typsecript ([9c526ed](https://github.com/paperlesspaper/paperlesspaper-web/commit/9c526edb042c25b66fd2f6d32124e331150f32b4))
* **web:** updated versions ([e87b11c](https://github.com/paperlesspaper/paperlesspaper-web/commit/e87b11cc381e57ed65858f6e931be060c51f66ad))
