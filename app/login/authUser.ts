import { fetchAuthSession, fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";

const PROFILE_URL = "https://6e3oue93qi.execute-api.us-east-1.amazonaws.com/default/profile";

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

export type ProfileStatus = "ok" | "missing" | "error";

// SAGE is a subscription service, and any Cognito sign-in (including a brand-new
// Google/Apple identity) succeeds without one. Access requires an existing SAGE
// profile row, so check it before showing the app. "error" means the lookup
// itself failed (network/server), which is not the same as having no profile.
export async function checkSageProfile(): Promise<{ status: ProfileStatus; username: string }> {
  let username = "";
  try {
    username = await getResolvedUsername();
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    const response = await fetch(`${PROFILE_URL}?username=${encodeURIComponent(username)}`, {
      method: "GET",
      headers: { Authorization: idToken, username },
    });
    if (response.status === 404) return { status: "missing", username };
    if (!response.ok) return { status: "error", username };
    const raw = await response.json();
    const profile = Array.isArray(raw) ? raw[0] : raw;
    const hasProfile = !!profile && typeof profile === "object" && Object.keys(profile).length > 0;
    return { status: hasProfile ? "ok" : "missing", username };
  } catch (err) {
    console.error("Error checking SAGE profile:", err);
    return { status: "error", username };
  }
}
