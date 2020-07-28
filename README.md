# rbank
This is a demo on how to integrate the `rbank-js` library into a JS project.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Browser Testing on local network

To run the Selenium tests with Nightwatch:

 - Run `ganache-cli`.
 - Create a `.env` file:
    - `account_passphrase=<12 words MetaMask passphrase>`
    - `account_password=<MetaMask password>`
 - To run the application `npm run serve`
 - To make sure Selenium was installed and run Selenium server`npm run selenium`
 - To run test on chrome `npm run e2e-chrome`

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).