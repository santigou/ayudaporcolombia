import { Link, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { CreatePoint } from "./pages/CreatePoint";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ModeratorDashboard } from "./pages/ModeratorDashboard";
import { useAuth } from "./context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white">
      <Link to="/" className="font-bold text-brand-dark">
        Ayuda por Colombia
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {user?.role === "moderator" && (
          <Link to="/moderador" className="text-gray-600 hover:text-brand-dark">
            Moderación
          </Link>
        )}
        {user ? (
          <>
            <span className="text-gray-500 hidden sm:inline">{user.name}</span>
            <button onClick={() => logout()} className="text-gray-600 hover:text-brand-dark">
              Salir
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-600 hover:text-brand-dark">
              Entrar
            </Link>
            <Link to="/registro" className="text-gray-600 hover:text-brand-dark">
              Registrarse
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function App() {
  return (
    <div className="flex flex-col h-full">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/crear" element={<CreatePoint />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/moderador" element={<ModeratorDashboard />} />
        </Routes>
      </div>
    </div>
  );
}
