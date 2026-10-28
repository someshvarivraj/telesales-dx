import { createContext, useContext } from 'react';

const stay = () => undefined;

/**
 * Called when the person follows a link from MoraBot to a screen: the panel steps aside
 * if it covers the page, so the screen is actually seen (the conversation is kept).
 */
export const LeaveContext = createContext<() => void>(stay);

export const useLeave = () => useContext(LeaveContext);
