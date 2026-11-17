import { Component, type ErrorInfo, type ReactNode } from "react";

import { WidgetBody } from "./WidgetBody";

interface Props {
  children: ReactNode;
  /** Changing it (e.g. a new config) clears the error. */
  resetKey: string;
}

interface State {
  error: Error | null;
  resetKey: string;
}

/** One broken widget must not take the whole dashboard down. */
export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    return props.resetKey === state.resetKey
      ? null
      : { error: null, resetKey: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Widget crashed", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <WidgetBody
          status="error"
          message="Erro ao desenhar o widget."
          onRetry={() => {
            this.setState({ error: null });
          }}
        />
      );
    }
    return this.props.children;
  }
}
