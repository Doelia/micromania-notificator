# micromania-notificator

Follow micromania games store. Receive notification for each new game released.

# Features
- Scrap micromania store and list games in a json file
- List games added/removed since last process
- Standalone webserver to list games
- Push notification on new games released

Platforms availables :
- Wii
- PS2 /PS3 / PS4
- Xbox / Xbox360
- DS / 3DS
- PSP

Tools
- Node
- MongoDB
- CasperJS / PhantomJS

## Install

Requirement
- Node.JS
- A mongoDB server

Install
```
npm install
export PATH="$PATH:./node_modules/.bin"
```

Set enviromment variables
```
export MONGO_DATABASE=''
```

## Use

Scrap pages of a platform, list games in json, store in mongodb and show difference since last
```
node index.js scrap --platform wii
```

Start webserver
```
node index.js serve --port 8080
```

### Notification
Register on [https://pushover.net/](Pushover) and put your user/token key in variable environment :
```
export PUSHOVER_USER_KEY=
export PUSHOVER_TOKEN=
```
Download PushOver application and login with your account.
