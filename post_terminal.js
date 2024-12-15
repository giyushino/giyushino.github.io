const fileMapping = {
  'home': '../index.html',
"thoughtgarden": "../thoughtgarden.html",
  "post1": "../post1.html",
  "post2": "../post2.html",
  "post3": "../post3.html",
  "post4": "../post4.html",
};


// Focus the terminal input when the page loads
window.onload = () => {
  const terminalInput = document.getElementById("terminal-input");
  terminalInput.focus(); // Focus on the input field when the page is loaded
};

document.addEventListener("keydown", (event) => {
  // Check if the pressed key is ":"
  if (event.key === ":") {
    const terminal = document.getElementById("terminal");
    const terminalInput = document.getElementById("terminal-input");
    
    // Prevent the ":" from being typed
    event.preventDefault();
    
    // Toggle terminal visibility
    terminal.classList.toggle("hidden");
    
    // If the terminal is visible, clear the input field and focus it
    if (!terminal.classList.contains("hidden")) {
      terminalInput.value = ""; // Clear the input field
      terminalInput.focus();    // Set focus to the terminal input
    }
  }
});

// Get the input and output elements
const userInput = document.getElementById('terminal-input');
const output = document.getElementById('output');

// Get the form element and prevent form submission
const form = document.querySelector('form');
form.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the form from submitting (and appending '#')
});

// Function to handle user input
userInput.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    const command = userInput.value.trim();
    userInput.value = '';  // Clear input field

    // Check if the command is "cd" and if the directory exists
    const splitCommand = command.split(' '); // Split command into words

    if (splitCommand[0] === 'cd') {
      const directory = splitCommand[1]; // The directory name after "cd"

      if (fileMapping[directory]) {
        // Display the message about changing directory
        output.innerHTML += `<div class="search-result">Changing directory to ${directory}...</div><br>`;

        // Navigate to the corresponding HTML page (like clicking a link)
        setTimeout(() => {
          window.location.href = fileMapping[directory];  // Directly navigate to the HTML page
        }, 500); // Optional: delay before redirecting for visual effect
      } else {
        output.innerHTML += `<div class="search-result">Directory not found: ${directory}</div><br>`;
      }
    } else if (splitCommand[0] === 'ls') {
      // If the command is "ls", list the available directories on a single line
      output.innerHTML += `<div class="search-result">Available directories: `;
      
      // Join all directory names (keys) with spaces and display on a single line
      output.innerHTML += Object.keys(fileMapping).join(' ') + `</div><br>`;
    } else {
      // If the command is not "cd" or "ls", display "Not a command"
      output.innerHTML += `<div class="search-result">Not a command: ${command}</div><br>`;
    }
  }
});

