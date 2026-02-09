import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import PageTransition from "@/components/page-transition";

/**
 * 404 Not Found page -- shown for unmatched routes.
 */
export default function NotFoundPage() {
  return (
    <PageTransition className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="mt-6">
        <Button className="gap-2">Back to Dashboard</Button>
      </Link>
    </PageTransition>
  );
}
