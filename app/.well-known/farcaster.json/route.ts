export async function GET() {
  return Response.json({
    accountAssociation: {
      header: "eyJmaWQiOjIyOTE0NywidHlwZSI6ImF1dGgiLCJrZXkiOiIweGREZDk1ODY4MDUzYzkxRjlFNzBBZDJjNmEzRDNGYzBlMmI0NjI2NDEifQ",
      payload: "eyJkb21haW4iOiJiYXNlc2NvcmUtY2VzYXItZnJlaXRhcy1wcm9qZWN0cy52ZXJjZWwuYXBwIn0",
      signature: "l3iW/wdJA6rksJTt6pBRgAjVdzCWDF5YDsjzLQ9/ec9Iuxhh9sceTazh/PrPvLIuzld58gVRiEPOPsFBbO0L3Rw="
    },
    frame: {
      version: "1",
      name: "BaseScore",
      iconUrl: "https://basescore-cesar-freitas-projects.vercel.app/icon.png",
      homeUrl: "https://basescore-cesar-freitas-projects.vercel.app",
      splashBackgroundColor: "#0052FF"
    }
  });
}
