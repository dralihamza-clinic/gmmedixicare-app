import { useAuth } from "../auth/AuthContext";
import Icon from "./Icon";

export default function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <button
      onClick={() => void signOut()}
      className="text-sm font-semibold text-on-primary-container/80 hover:text-secondary-fixed transition-colors flex items-center gap-1"
    >
      <Icon name="logout" className="text-lg" />
      Sign Out
    </button>
  );
}
