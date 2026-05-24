import { useAuth } from "@/contexts/AuthContext";
import { fullName, useProfile } from "@/lib/profileStore";
import { userNameByEmail } from "@/lib/usersDirectory";

export function useCurrentUser() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const profile = useProfile(email);
  const name =
    fullName(profile, "") || userNameByEmail(email) || email.split("@")[0];
  return { email, name };
}
