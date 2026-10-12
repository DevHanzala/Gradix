import useAuthStore from "../store/authStore.js";
import AppShell from "./AppShell.jsx";
import PublicLayout from "./PublicLayout.jsx";

/** Signed-in users get the app shell (sidebar/drawer); visitors get the public layout. */
const MainLayout = ({ children }) => {
  const { token, user } = useAuthStore();
  return token && user ? <AppShell>{children}</AppShell> : <PublicLayout>{children}</PublicLayout>;
};

export default MainLayout;
