import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="promise-brand" aria-label="Pinky Promise home">
      <span className="promise-brand-mark" aria-hidden="true">
        <Heart size={21} />
      </span>
      {!compact && (
        <span className="promise-brand-name">
          Pinky Promise<small>CAFÉ & RESTAURANT</small>
        </span>
      )}
    </Link>
  );
}
