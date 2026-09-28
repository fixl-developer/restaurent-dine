import { NavLink } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Brand from "./Brand";

export default function GuestHeader() {
  return (
    <header className="guest-header">
      <Brand />
      <nav aria-label="Café navigation">
        <NavLink to="/menu">Our menu</NavLink>
        <NavLink to="/reserve">Book a table</NavLink>
        <a href="/#visit">
          Visit us <ArrowUpRight size={14} />
        </a>
      </nav>
    </header>
  );
}
