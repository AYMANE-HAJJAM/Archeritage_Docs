"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowDownToLine, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  displayName: string;
  onDownload?: () => void;
};

type State = { hasError: boolean };

/**
 * Isolates react-pdf / fetch failures so a 422 preview never collapses
 * the heritage workspace into the route error boundary.
 */
export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Document preview crashed:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.displayName !== this.props.displayName && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 bg-zinc-900 p-8 text-center text-zinc-300">
          <FileText className="size-12 stroke-1 text-zinc-500" aria-hidden />
          <div>
            <p className="text-sm font-medium">
              Aperçu indisponible pour ce fichier.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Vous pouvez télécharger le document original pour le consulter.
            </p>
          </div>
          {this.props.onDownload ? (
            <Button
              onClick={this.props.onDownload}
              className="mt-2 bg-primary text-primary-foreground"
            >
              <ArrowDownToLine className="mr-2 size-4" />
              Télécharger
            </Button>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
