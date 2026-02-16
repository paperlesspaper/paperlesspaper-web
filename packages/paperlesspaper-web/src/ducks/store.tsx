import { configureStore, isRejectedWithValue } from "@reduxjs/toolkit";
import type { Middleware } from "@reduxjs/toolkit";
import { emptySplitApi } from "ducks/emptyApi";
import globalState from "ducks/globalState";
import auth from "ducks/auth";
/*const saveSubsetBlacklistFilter = createBlacklistFilter("auth", [
  "error",
  "errorResponse",
]);*/

/*const persistConfig = {
  key: "root",
  storage,
  timeout: 500,
  //transforms: [saveSubsetBlacklistFilter],
  blacklist: ["router", "auth"],
};*/

// export const history = createBrowserHistory();
//const persistedReducer = persistReducer(persistConfig, rootReducer(history));

// create the saga middleware
//const sagaMiddleware = createSagaMiddleware();

/*const composeEnhancers =
  typeof window === "object" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({})
    : compose;*/

/*const enhancer = composeEnhancers(
  applyMiddleware(sagaMiddleware )
);*/

export const rtkQueryErrorLogger: Middleware = (/*api: MiddlewareAPI*/) =>
  (next) =>
  (action) => {
    if (isRejectedWithValue(action)) {
      const { ...data } = action;

      store.dispatch({
        type: "globalState/addError",
        payload: JSON.parse(JSON.stringify(data)), //TODO: Check
      });
    }

    return next(action);
  };

const storeEntry = configureStore({
  reducer: {
    auth: auth.reducer,
    globalState: globalState.reducer,
    [emptySplitApi.reducerPath]: emptySplitApi.reducer,
  }, //rootReducer(), //persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      emptySplitApi.middleware,
      rtkQueryErrorLogger,
    ),
});

//sagaMiddleware.run(rootSaga);

export const store = storeEntry;
//export const persistor = persistStore(storeEntry);
