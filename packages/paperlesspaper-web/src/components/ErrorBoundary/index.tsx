/* eslint-disable react/no-is-mounted */

import React from "react";
import { Button } from "@progressiveui/react";

import styles from "./styles.module.scss";

export default class ErrorBoundaryWrapper extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  //useAuthStatus

  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    // You can also log error messages to an error reporting service here
  }

  reload = () => {
    window.location.replace(window.location.pathname);
    //window.location.reload(false);
  };

  clearLocalStorage = () => {
    localStorage.clear();
    window.location.replace(window.location.pathname);
    //window.location.reload(false);
  };

  render() {
    /*if (import.meta.env.MODE === "development") {
      // eslint-disable-next-line react/prop-types
      return this.props.children;
    } */
    if (this.state.errorInfo) {
      // Error path
      return (
        <div className={styles.errorWrapper}>
          <h2>Something went wrong.</h2>
          <h2 className={styles.frenchTitle}>Etwas ist schief gelaufen.</h2>

          <Button onClick={this.reload}>Reload</Button>
          <br />

          <Button kind="tertiary" onClick={this.clearLocalStorage}>
            Clear localStorage
          </Button>
          <br />

          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    // Normally, just render children
    // eslint-disable-next-line react/prop-types
    return this.props.children;
  }
}

/*
export function ErrorBoundaryReplacement({ children }: any) {
  return <>{children}</>;
}

export default function ErrorBoundaryWrapper({ children }: any) {
  const ErrorBoundryComponent =
    import.meta.env.NODE_ENV === "development"
      ? ErrorBoundaryReplacement
      : ErrorBoundary;
  return <ErrorBoundryComponent>{children}</ErrorBoundryComponent>;
}
*/
