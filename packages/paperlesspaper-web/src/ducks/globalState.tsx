import { createSlice } from "@reduxjs/toolkit";

const globalState = createSlice({
  name: "globalState",
  initialState: {
    errors: [],
    lastUser: undefined,
    lastQueryArguments: {},
  },
  reducers: {
    addError: (state, action) => {
      state.errors.push(action.payload);
    },
    setLastUser: (state, action) => {
      state.lastUser = action.payload;
    },
    setLastQueryArguments: (state, action) => {
      state.lastQueryArguments = action.payload;
    },
    reset: (state) => {
      state.errors = [];
    },
  },
});

export default globalState;
