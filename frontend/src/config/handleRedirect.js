import { getRedirectResult } from "firebase/auth";
import axios from "axios";
import useAuthStore from "../store/authStore";
import { auth } from "../config/firebase";

export const handleGoogleRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;

    const firebaseUser = result.user;
    console.log("🔁 Redirect login success:", firebaseUser.email);

    const response = await axios.post("/auth/google-auth", {
      name: firebaseUser.displayName,
      email: firebaseUser.email,
      uid: firebaseUser.uid,
    });

    const { token, user } = response.data;
    useAuthStore.getState().setState({ token, user });

    return user;

  } catch (error) {
    console.error("❌ Google redirect handler error:", error);
    return null;
  }
};
