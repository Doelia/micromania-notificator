# micromania-notificator

Follow micromania games store. Receive notification for each new game released.

## Features
- Scrap micromania store and list games (print + store in json file + store in database)
- List games added/removed since last process
- Standalone webserver to list games
- Push notification on new games released

Platforms availables :
- PS2 /PS3 / PS4
- Xbox / Xbox360
- Wii
- DS / 3DS
- PSP

Tools used
- Node
- MongoDB
- CasperJS / PhantomJS

## Installation

Requirement
- Node / NPM
- A mongoDB server

Install
```
npm install
```

Set path bineraies files for casperJS
```
export PATH="$PATH:./node_modules/.bin"
```

## Configuration

Locales variables availables :
- `MONGODB` Path of mongodb server (required)
- `PORT` Port for webserver (default 8080)
- `PUSHOVER_USER_KEY` and `PUSHOVER_TOKEN` to receive pushover notification (default empty)
- `WEB_URL` Base url to put in link of notification (default http://localhost:PORT/)

Each variable can be pased :
- By enviromment variable
- In a `config.json` file
- By param at launch (eg. --PORT 80)

## Use

Scrap pages of a platform, list games in last_storage.json, store in mongodb and show difference since last :
```
npm run scrap -- --platform wii
```
Tip : Add it in a crontab

Start webserver :
```
npm run serve
```

### Notification
Register on [Pushover](https://pushover.net/) and put your user/token key in config file.
Download *Pushover* application and login with your account.
