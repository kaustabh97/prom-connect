export const handler = async (event: any) => {
    const email = event.request.userAttributes.email;
  
    if (!email.endsWith('@iima.ac.in')) {
      throw new Error('Only IIMA email IDs are allowed');
    }
  
    return event;
  };