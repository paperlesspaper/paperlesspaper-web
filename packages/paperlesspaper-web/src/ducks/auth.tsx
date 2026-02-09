import { createSlice } from "@reduxjs/toolkit";

const initialState = { localLogin: false, active: false, dates: {} };

const auth: any = createSlice({
  name: "auth",
  initialState: initialState,
  reducers: {
    login: (state, action) => action.payload,
    logout: () => initialState,
    updateStatus: (state, action) => {
      return { ...state, status: action.payload };
    },
    updateFilterDates: (state, action) => {
      return { ...state, dates: action.payload };
    },
    setTokenSync: (state, action) => {
      return { ...state, token: action.payload };
    },
    updateFilterStatus: (state, action) => {
      return { ...state, active: action.payload };
    },
  },
});

auth.selectors = { authState: (state) => state.auth.status };
export const getAuthToken = (state) => state.auth.token;

export default auth;
