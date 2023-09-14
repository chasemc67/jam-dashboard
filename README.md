# 🌈 💩 Jam Dashboard

Jam dashboard is a simply highly-configurable tooling for finding/visualizing specific notes on a guitar fretboard with arbitrary tunings.  
Most other tools either don't support custom tunings, or will only show entire scales/arpegios/etc.   
With Jam Dashboard you can highlight just the notes you need, in any tuning, and with specific colors per-note

<img width="1722" alt="Screenshot 2023-03-31 at 9 56 44 PM" src="https://user-images.githubusercontent.com/6922982/229266427-300f405f-9b37-4502-83d9-df733fd2b91a.png">

## Running Locally
```
npm start
npm run storybook
```

## Deploying Changes to Firebase
```
npm run build
firebase deploy
```

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run storybook`

Runs the storybook that lets you interact with the components

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.