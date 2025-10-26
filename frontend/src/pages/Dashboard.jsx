import { useAuth } from "../auth";
import Professor from "./Professor";
import Student from "./Student";

export default function Dashboard(){
  const { user } = useAuth();
  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <p className="muted">Signed in as <b>{user.email}</b> ({user.role})</p>
      {user.role === "PROF" ? <Professor/> : <Student/>}
    </div>
  );
}
