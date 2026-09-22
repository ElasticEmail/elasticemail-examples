import { FatalErrorBoundary, RedwoodProvider } from "@redwoodjs/web";
import FatalErrorPage from "src/pages/FatalErrorPage/FatalErrorPage";
import Routes from "src/Routes";
import "./index.css";

// No GraphQL in these examples, so RedwoodApolloProvider is left out. Pages call the
// serverless functions under /.redwood/functions with fetch.
const App = () => (
  <FatalErrorBoundary page={FatalErrorPage}>
    <RedwoodProvider titleTemplate="%PageTitle - Elastic Email Examples">
      <Routes />
    </RedwoodProvider>
  </FatalErrorBoundary>
);

export default App;
