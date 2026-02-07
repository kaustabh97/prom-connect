export const handler = async (event: any) => {
  const email = event?.request?.userAttributes?.email;
  console.log("[post-authentication] trigger", {
    triggerSource: event?.triggerSource,
    email,
    userName: event?.userName,
  });

  if (!email || !email.endsWith("@iima.ac.in")) {
    console.error("[post-authentication] reject", { email });
    throw new Error("Only IIMA email IDs are allowed");
  }

  console.log("[post-authentication] allow", { email });
  return event;
};