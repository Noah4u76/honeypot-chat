const SERVER_ADDRESS = "wss://localhost:8001"; //Change IP before commiting
const socket = new WebSocket(SERVER_ADDRESS);
let userList = []
const username = localStorage.getItem("username");
if (!username) {
  // If there's no username in localStorage, redirect to login.
  window.location.href = "login.html";
}

socket.onopen = () => {
  // After opening WebSocket, send "join" with the username
  socket.send(JSON.stringify({ type: "join", username }));

};

socket.onmessage = (event) => {
  console.log("Raw data received:", event.data);
  const data = JSON.parse(event.data);
  console.log("Parsed data:", data);

  if (data.type === "message") {
    // Decrypt the message before displaying
    window.decrypt(data.message)
      .then((decryptedMessage) => {
        displayMessage(data.username, decryptedMessage, data.username === username ? "sent" : "received");
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  } else if (data.type === "notification") {
    alert("a user list ", data.userList);
    for(let i = 0; i < data.userList.length; i++)
    { 
      alert(data.userList[i]);
    }
    changeUserList(data.userList)
    window.decrypt(data.message)
      .then((decryptedMessage) => {
        alert(decryptedMessage)
        if(decryptedMessage.indexOf("joined") !== -1)
        {
          alert("username is added")
        }
        if(decryptedMessage.indexOf("disconnected") !== -1)
        {
          alert("username is removed")
        }
        displaySystemMessage(decryptedMessage);
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  } else if (data.type === "error") {
    console.error("Error from server:", data.error);
  } else if (data.type === "file") {

      alert("Receivedf message");

      window.decrypt(data.data)
      .then((decryptedData) => {
        
        //write a new file and display the download link with the decryptedData
        alert("Being show")
        displayFileLink(data.filename, decryptedData);
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });



  }
};

document.getElementById("send-btn").addEventListener("click", sendMessage);

document.getElementById("message").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileInput");
  const reciever = document.getElementById("who-to-send").value;

  const message = messageInput.value.trim();
  const file = fileInput.files[0];

  if (!message && !file) return; // Do nothing if both are empty
  // Send plain text message; the server will encrypt it.
  

  if (!fileInput) return;

  if(message)
  {
    socket.send(JSON.stringify({ type: "message", username, reciever, message }));
    messageInput.value = "";
  }


  if (file) {
    alert("Contains data");
    const reader = new FileReader();

    reader.onload = function (event) {
        const fileData = event.target.result; 

        socket.send(JSON.stringify({
            type: "file",
            username,
            filename: file.name,
            filetype: file.type,
            data: fileData
        }));

        console.log("File sent:", file.name); 
        fileInput.value = ""; 
    };

    reader.readAsText(file); 
}




}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("username");
  window.location.href = "login.html";
});

function displayMessage(user, message, type) {
  const chatDiv = document.getElementById("messages");
  const msgElement = document.createElement("div");
  msgElement.classList.add("message", type);
  msgElement.innerHTML = `<b>${user}:</b> ${message}`;
  chatDiv.appendChild(msgElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}


function displayFileLink(filename, text) {
  const chatDiv = document.getElementById("messages");
  
  const msgElement = document.createElement("div");
  msgElement.classList.add("message", "received"); 

  const fileElement = document.createElement("a");
  fileElement.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  fileElement.setAttribute('download', filename);
  
  fileElement.innerText = `Download file: ${filename}`;
  
  fileElement.style.color = 'blue';
  fileElement.style.textDecoration = 'underline';

  msgElement.appendChild(fileElement);

  chatDiv.appendChild(msgElement);

  chatDiv.scrollTop = chatDiv.scrollHeight;
}





function changeUserList(userlist)
{
  alert(userlist);


  const selectElement = document.getElementById('who-to-send');
  for (let i = 0; i < selectElement.options.length; i++) {
      if (selectElement.options[i].value !== "All") 
      {
          selectElement.remove(i);
      }
  }

  userlist.forEach((element) =>
    {

      const existingOption = document.createElement('option'); // Create a new option element
      existingOption.value = element;
      existingOption.text = `${element}`;
      selectElement.append(existingOption);
    }
    
  )
}







function displaySystemMessage(message) {
  const chatDiv = document.getElementById("messages");
  const msgElement = document.createElement("div");
  msgElement.classList.add("message", "received");
  msgElement.innerHTML = `<b>System:</b> ${message}`;
  chatDiv.appendChild(msgElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}
