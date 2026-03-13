export async function GET() {
  return Response.json({
    accountAssociation: {
      header: "",
      payload: "",
      signature: ""
    },
    frame: {
      version: "1",
      name: "BaseScore",
      iconUrl: "https://basescore-cesar-freitas-projects.vercel.app/icon.png",
      homeUrl: "https://basescore-cesar-freitas-projects.vercel.app",
      splashBackgroundColor: "#0052FF",
      webhookUrl: ""
    }
  });
}
