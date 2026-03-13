import { useAuth } from "../auth";
import Professor from "./Professor";
import Student from "./Student";

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === "PROF" ? <Professor /> : <Student />;
}
