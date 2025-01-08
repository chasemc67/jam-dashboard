# Jam Dashboard

Jam dashboard is a simply highly-configurable tooling for finding/visualizing specific notes on a guitar fretboard with arbitrary tunings.  
Most other tools either don't support custom tunings, or will only show entire scales/arpegios/etc.  
With Jam Dashboard you can highlight just the notes you need, in any tuning, and with specific colors per-note

<img width="1722" alt="Screenshot 2023-03-31 at 9 56 44 PM" src="https://user-images.githubusercontent.com/6922982/229266427-300f405f-9b37-4502-83d9-df733fd2b91a.png">

## Development

Run the dev server:

```shellscript
npm run dev
```

Run Tests:

```shellscript
npm run test
```

## TODO

```
npm run storybook

npm run format
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

- `build/server`
- `build/client`

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.
