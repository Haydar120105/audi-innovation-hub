import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isLight = resolvedTheme === "light";
  const nextTheme = isLight ? "dark" : "light";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={isLight ? "Dark Mode aktivieren" : "Light Mode aktivieren"}
          onClick={() => setTheme(nextTheme)}
          className="theme-toggle fixed bottom-5 right-5 z-[70] grid h-10 w-10 place-items-center rounded-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200"
        >
          {isLight ? <Moon size={17} strokeWidth={1.8} /> : <Sun size={17} strokeWidth={1.8} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {isLight ? "Dark Mode" : "Light Mode"}
      </TooltipContent>
    </Tooltip>
  );
}
