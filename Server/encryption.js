export function encrypt(message,shift) {


    
 const characters = [
    // Letters
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',

    // Digits
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',

    // Hexadecimal characters (used in encryption)
    'A', 'B', 'C', 'D', 'E', 'F', 'a', 'b', 'c', 'd', 'e', 'f',

    // Base64 characters (used in encoding encrypted data)
    '+', '/', '=',

    // Common punctuation and symbols in JavaScript
    ' ', '.', ',', ';', ':', '!', '?', '@', '#', '$', '%', '^', '&', '*', '(', ')', '[', ']', '{', '}', '<', '>', '/', '\\', '|', '_', '-',

    // Quotes (used in strings)
    '"', "'", '`',

    // Assignment and operators (only single characters kept)
    '=', '+', '-', '*', '/', '%', '>', '<', '!', '&', '|', '?'
];


    let encryptedstring = ""

    for (let i = 0; i < message.length; i++) {
        let char = message[i];
        let index = characters.indexOf(char);
        if (index !== -1) {
            let newIndex = (index + shift) % characters.length;
            encryptedstring += characters[newIndex];
        } else {
            encryptedstring += char;
        }
    }

    return encryptedstring;
    




    
    






    /*let val = btoa(message);
    return val;*/

}