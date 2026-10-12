import { FaGoogle } from "react-icons/fa";
import Button from "./ui/Button.jsx";

function GoogleButton({ loading, onClick, children = "Continue with Google" }) {
  return (
    <Button variant="secondary" fullWidth icon={FaGoogle} loading={loading} onClick={onClick}>
      {children}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase text-ink-subtle" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export default GoogleButton;
