import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";

// Cognito assigns federated sign-ins (e.g. Google) an auto-generated username
// like "Google_12345" instead of the email. This app's data model treats the
// username as the email address, so always prefer the verified email claim
// over the raw Cognito username to keep federated and password logins consistent.
export async function getResolvedUsername() {
  const [user, attributes] = await Promise.all([
    getCurrentUser(),
    fetchUserAttributes(),
  ]);
  return attributes.email || user.username;
}
