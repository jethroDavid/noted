import { ApiError, createApiClient } from "@noted/api-client";
import { webAuth } from "../auth/firebase-auth";

// Credentials are read for each request, never captured from a previous account.
export const homeApi = createApiClient({
  getIdToken: async () => {
    const user = webAuth().currentUser;
    if (!user) throw new ApiError(401, "Sign in to continue.");
    return user.getIdToken();
  },
});
