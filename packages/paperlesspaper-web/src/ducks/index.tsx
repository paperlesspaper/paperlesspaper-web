import { combineReducers } from "redux";
import globalState from "./globalState";
import auth from "./auth";
import { emptySplitApi } from "./emptyApi";

const rootReducer = () =>
  combineReducers({
    auth: auth.reducer,
    globalState: globalState.reducer,
    [emptySplitApi.reducerPath]: emptySplitApi.reducer,
  });

export default rootReducer;
