export function encrypt(message) {
    let val = btoa(message);
    return val;

}