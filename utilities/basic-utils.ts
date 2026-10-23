import { expect } from "@playwright/test";
import { APIResponse } from "@playwright/test";

// // Functionalities
export const throwingError = (message:string) => { throw new Error(message) }; 

export async function verifyStatusCodeandReturnJSON(response:APIResponse, expectedStatusCode:number):Promise<unknown>{
    expect(response.status()).toBe(expectedStatusCode); 
    if (response.status() !== 204) { return await response.json() }
};