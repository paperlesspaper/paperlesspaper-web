# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.238.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.237.0...v1.238.0) (2026-05-27)


### Features

* update epdoptimize dependency to version 1.1.1 in both API and web packages ([f152824](https://github.com/paperlesspaper/paperlesspaper-web/commit/f15282477c364835409ce0a704221d127176ac43))





# [1.237.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.236.0...v1.237.0) (2026-05-27)


### Features

* adjust sync timing condition in cronjobPapers for improved metrics tracking ([f3a0ff6](https://github.com/paperlesspaper/paperlesspaper-web/commit/f3a0ff67191e4908ac58eb842d07734273da3418))
* update slide handling logic and add integration tests for slides service ([fe1be7f](https://github.com/paperlesspaper/paperlesspaper-web/commit/fe1be7f1b0d8a8e230a665891ae23f55a6bdc4aa))





# [1.236.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.235.0...v1.236.0) (2026-05-27)


### Features

* add preview dithering tool with adjustable settings ([329b7b6](https://github.com/paperlesspaper/paperlesspaper-web/commit/329b7b6e81919232d49c6577f98e12ec6750f7be))





# [1.235.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.234.0...v1.235.0) (2026-05-26)


### Features

* Add ArtBrowser component for artwork search and integration with image editor ([045da2a](https://github.com/paperlesspaper/paperlesspaper-web/commit/045da2a45858cd1184a13e841d2ff9c3aedc9246))
* Add Playwright tests for image upload responses and enhance error handling in user management ([39712c8](https://github.com/paperlesspaper/paperlesspaper-web/commit/39712c8e47948804f145c580824ce8c7743b03cc))
* Enhance image upload error handling and improve integration form logic ([809d50a](https://github.com/paperlesspaper/paperlesspaper-web/commit/809d50a931f2033d41c565ecb764c0175161703e))
* Implement share target functionality and enhance image handling ([565b417](https://github.com/paperlesspaper/paperlesspaper-web/commit/565b4171548574db8a3fd78f081602d65b82ffa8))





# [1.234.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.233.0...v1.234.0) (2026-05-25)


### Features

* bump version to 1.233.1 ([a282657](https://github.com/paperlesspaper/paperlesspaper-web/commit/a282657dc6eed1cb95c55305150ac0b6eb6a547c))
* enhance Playwright CI with caching and improve error handling in image upload ([da3903a](https://github.com/paperlesspaper/paperlesspaper-web/commit/da3903a2d440b64bfc12fe9a232bdc782d52c1bc))
* update @internetderdinge/api to version 1.229.41 ([e3c8d19](https://github.com/paperlesspaper/paperlesspaper-web/commit/e3c8d19f6320a56ea6fd15dc434c2a44c89a5c9c))





# [1.233.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.232.2...v1.233.0) (2026-05-20)


### Features

* update @internetderdinge/api to version 1.229.40 ([eb86aa3](https://github.com/paperlesspaper/paperlesspaper-web/commit/eb86aa3da4003cc19fd8ce88e5370e0b28a167cf))





## [1.232.2](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.232.0...v1.232.2) (2026-05-20)

**Note:** Version bump only for package @paperlesspaper/api





# [1.232.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.231.0...v1.232.0) (2026-05-20)


### Features

* update @internetderdinge/api to version 1.229.39 and enhance API integration ([d2e5c7c](https://github.com/paperlesspaper/paperlesspaper-web/commit/d2e5c7c0f9a87f71bf41a61bacc03a43e7780366))





# [1.231.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.230.12...v1.231.0) (2026-05-14)


### Features

* enhance image editor functionality and improve CORS handling ([bc26ada](https://github.com/paperlesspaper/paperlesspaper-web/commit/bc26ada9dcf89404910caa9a1cc85b66d30598f6))





## [1.230.12](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.230.11...v1.230.12) (2026-05-14)

**Note:** Version bump only for package @paperlesspaper/api





# [1.230.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.229.0...v1.230.0) (2026-05-04)


### Bug Fixes

* enhance cronjobPapers to accept job parameter and add dynamic-integration action ([e6e435d](https://github.com/paperlesspaper/paperlesspaper-web/commit/e6e435d2e1237f9cb823c9ddfa6dd78a62027d3b))
* ensure BullMQ starts correctly in production and refactor page navigation in render service ([8d72516](https://github.com/paperlesspaper/paperlesspaper-web/commit/8d72516a737f9650b2c988d9d0e24fc3a89b6a4f))
* include type in postMessage for Google Calendar integration ([9fc80e6](https://github.com/paperlesspaper/paperlesspaper-web/commit/9fc80e6e08d89b10299d4ef8f8de970d8652bf5b))
* increase DEVICE_BATCH_SIZE for improved device processing in cronjob ([1769443](https://github.com/paperlesspaper/paperlesspaper-web/commit/1769443d6d51efae4497138f9e67a4a2bf07736c))
* reduce DEVICE_BATCH_SIZE for optimized device processing in cronjob ([0bfd3c2](https://github.com/paperlesspaper/paperlesspaper-web/commit/0bfd3c2b78729cef55d634635577884aa27bb558))
* streamline cronjob initialization and update image generation logic ([3174ca0](https://github.com/paperlesspaper/paperlesspaper-web/commit/3174ca0c106fd15320acfb4bf9438c7dc4e1d755))
* update papers cronjob to increase DEVICE_BATCH_SIZE and adjust upsertEvery interval ([3d797ac](https://github.com/paperlesspaper/paperlesspaper-web/commit/3d797aced7044d5dc15462292f1c450989c5d01b))
* wait until all network connections finished before taking screenshot ([f07953e](https://github.com/paperlesspaper/paperlesspaper-web/commit/f07953ee55655f6efc088df39b441fda8e5e93d9))
* **web:** nixpack changed ([caf1cd1](https://github.com/paperlesspaper/paperlesspaper-web/commit/caf1cd154315f67a806f26a1c3e8c61843a7b47e))
* **web:** removed orange ([3ca0c19](https://github.com/paperlesspaper/paperlesspaper-web/commit/3ca0c19953d805f27ebd281ff7173c0e51faea53))
* **web:** switch to caddy in nixpack ([c3e8512](https://github.com/paperlesspaper/paperlesspaper-web/commit/c3e851273a3e8a7d496bf9bddca226249ce70e2f))
* **web:** updating api docs ([3dd3bf7](https://github.com/paperlesspaper/paperlesspaper-web/commit/3dd3bf7bdc1db51ce4f557501d1da1863ebe9551))


### Features

* **web:** add optional picture field to uploadSingleImageSchema and improve console log clarity in PhotoFrame ([ae4db3e](https://github.com/paperlesspaper/paperlesspaper-web/commit/ae4db3e5ff553736aafdf3e93ff1dc3f5b49043e))
* **web:** implement mergeUrlWithQueryParams function for URL handling ([91a4733](https://github.com/paperlesspaper/paperlesspaper-web/commit/91a4733e5fc651a76f959347b7d87d963ebf0e63))
* **web:** improved colors and upload flexibility ([93ebe75](https://github.com/paperlesspaper/paperlesspaper-web/commit/93ebe75dc3cba527d9a1148eecca346be008c058))
* **web:** update CSS editor to include Callout for user guidance and improve helper text ([0c6bea5](https://github.com/paperlesspaper/paperlesspaper-web/commit/0c6bea5409996fe7b67158f67d62ab2827e33330))
* **web:** updated env simplified handler ([da1b450](https://github.com/paperlesspaper/paperlesspaper-web/commit/da1b450eb33a75a0d8ae46fb4385cffc028e640c))





# [1.229.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.228.0...v1.229.0) (2026-04-08)


### Features

* **web:** switch to BullMq and updated Onboarding ([3d41594](https://github.com/paperlesspaper/paperlesspaper-web/commit/3d41594d7d5e0763c4f72dad5fa8e649826079d1))





# [1.228.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.227.1...v1.228.0) (2026-03-08)


### Features

* **web:** updated commit hooks ([2cebcaa](https://github.com/paperlesspaper/paperlesspaper-web/commit/2cebcaa863db3193923762f68acef50b31bb803f))





## [1.227.1](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.227.0...v1.227.1) (2026-03-08)

**Note:** Version bump only for package @paperlesspaper/api





# [1.227.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.226.1...v1.227.0) (2026-03-08)


### Features

* **packages:** release updated ([1fdb90c](https://github.com/paperlesspaper/paperlesspaper-web/commit/1fdb90ca478674f75e1f2f646319280fa61f0210))





## [1.226.1](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.226.0...v1.226.1) (2026-03-07)

**Note:** Version bump only for package @paperlesspaper/api





# [1.226.0](https://github.com/paperlesspaper/paperlesspaper-web/compare/v1.225.0...v1.226.0) (2026-03-07)


### Bug Fixes

* **api:** npmrc removed from docker ([58b9607](https://github.com/paperlesspaper/paperlesspaper-web/commit/58b9607ce8e5063a271bacb9eefac79ac372f6c2))


### Features

* **api:** release helpers ([9379928](https://github.com/paperlesspaper/paperlesspaper-web/commit/9379928e3cd9d4576473aab6d7f07f66855cae5a))





# 1.225.0 (2026-03-07)


### Bug Fixes

* **web:** removed lockfiles ([ea22a0e](https://github.com/paperlesspaper/paperlesspaper-web/commit/ea22a0e5dc1b5a6d162c72e42c89f01d990443a4))


### Features

* **web:** added fly config to repository ([bf16faa](https://github.com/paperlesspaper/paperlesspaper-web/commit/bf16faac2224605c3322e594644f0c13dfbc684e))
* **web:** continuing decoupling ([ed5c4cd](https://github.com/paperlesspaper/paperlesspaper-web/commit/ed5c4cd1c6dbdb55dca968484e1173aaff325e3c))
* **web:** continuing decoupling ([f8c85f4](https://github.com/paperlesspaper/paperlesspaper-web/commit/f8c85f4408c911149c46d71d12ce1497347e1be1))
* **web:** initial commit ([d581188](https://github.com/paperlesspaper/paperlesspaper-web/commit/d581188d25df42f5ab07c1cedd77321ab03eafa5))
* **web:** initial commit ([d1ca81b](https://github.com/paperlesspaper/paperlesspaper-web/commit/d1ca81be459cee7b5480ff59c82a768d640cef4f))
* **web:** initial commit ([db2a421](https://github.com/paperlesspaper/paperlesspaper-web/commit/db2a42132f7d360c0f78c64761c839da81fe9d2a))
* **web:** initial commits ([3a9fd1f](https://github.com/paperlesspaper/paperlesspaper-web/commit/3a9fd1fbe079c191c00caa723d3ec817a188325a))
* **web:** initial Dockerfile ([9abfaf9](https://github.com/paperlesspaper/paperlesspaper-web/commit/9abfaf98a41d4e9a3e56bac03184ee0a13b57211))
* **web:** more initial ([601d668](https://github.com/paperlesspaper/paperlesspaper-web/commit/601d66822772161d19881c71f9d783dd09b14c94))
* **web:** update versions ([077ebee](https://github.com/paperlesspaper/paperlesspaper-web/commit/077ebee383865e8410aa2bc95469cb41a3001838))
* **web:** updated versions ([e87b11c](https://github.com/paperlesspaper/paperlesspaper-web/commit/e87b11cc381e57ed65858f6e931be060c51f66ad))





## [1.224.2](https://dev.azure.com/wirewire/memo/_git/memo-mono/compare/v1.224.1...v1.224.2) (2026-02-07)

**Note:** Version bump only for package @paperlesspaper/api
