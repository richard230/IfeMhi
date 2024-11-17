// scripts/app.js

// Initialize local storage for student records, schedules, and notes
const studentData = JSON.parse(localStorage.getItem('students')) || [];
const scheduleData = JSON.parse(localStorage.getItem('schedule')) || [];
const notesData = JSON.parse(localStorage.getItem('notes')) || [];

// Render student data
function renderStudents() {
    const tableBody = document.querySelector("#student-table tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    studentData.forEach((student, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${student.name}</td>
            <td>${student.paymentType}</td>
            <td>${student.date}</td>
            <td>${student.status ? "Paid" : "Unpaid"}</td>
            <td>
                <button onclick="editStudent(${index})">Edit</button>
                <button onclick="removeStudent(${index})">Remove</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Add new student
document.getElementById("add-student-btn").addEventListener("click", () => {
    const name = prompt("Enter student name:");
    const paymentType = prompt("Enter payment type (e.g., manual/book):");
    const date = new Date().toLocaleDateString();
    const status = confirm("Mark as Paid?");

    studentData.push({ name, paymentType, date, status });
    localStorage.setItem("students", JSON.stringify(studentData));
    renderStudents();
});

// Reset filters and re-render
document.getElementById("reset-filters-btn").addEventListener("click", () => {
    renderStudents();
});

// Export student list to PDF
document.getElementById("export-student-pdf").addEventListener("click", () => {
    const doc = new jsPDF();
    let content = "Student Records\n\n";
    studentData.forEach((student, index) => {
        content += `${index + 1}. ${student.name} - ${student.paymentType} - ${student.date} - ${student.status ? "Paid" : "Unpaid"}\n`;
    });
    doc.text(content, 10, 10);
    doc.save("students.pdf");
});

// Initialize the app
renderStudents();
// Render Class Schedule
function renderSchedule() {
    const tableBody = document.querySelector("#schedule-table tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    scheduleData.forEach((row, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.day}</td>
            <td>${row.course}</td>
            <td>${row.time}</td>
            <td>${row.venue}</td>
            <td>
                <button onclick="editSchedule(${index})">Edit</button>
                <button onclick="removeSchedule(${index})">Remove</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Add new schedule row
document.getElementById("add-schedule-row").addEventListener("click", () => {
    const day = prompt("Enter day:");
    const course = prompt("Enter course:");
    const time = prompt("Enter time:");
    const venue = prompt("Enter venue:");

    scheduleData.push({ day, course, time, venue });
    localStorage.setItem("schedule", JSON.stringify(scheduleData));
    renderSchedule();
});

// Edit a schedule row
function editSchedule(index) {
    const row = scheduleData[index];
    const newDay = prompt("Edit day:", row.day);
    const newCourse = prompt("Edit course:", row.course);
    const newTime = prompt("Edit time:", row.time);
    const newVenue = prompt("Edit venue:", row.venue);

    scheduleData[index] = { day: newDay, course: newCourse, time: newTime, venue: newVenue };
    localStorage.setItem("schedule", JSON.stringify(scheduleData));
    renderSchedule();
}

// Remove a schedule row
function removeSchedule(index) {
    scheduleData.splice(index, 1);
    localStorage.setItem("schedule", JSON.stringify(scheduleData));
    renderSchedule();
}

// Initialize the schedule section
renderSchedule();

// Render Notes
function renderNotes() {
    const notesList = document.getElementById("notes-list");
    notesList.innerHTML = ""; // Clear existing notes

    notesData.forEach((note, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
            ${note.content}
            <button onclick="editNote(${index})">Edit</button>
            <button onclick="removeNote(${index})">Remove</button>
        `;
        notesList.appendChild(li);
    });
}

// Add new note
document.getElementById("add-note").addEventListener("click", () => {
    const content = prompt("Enter your note:");
    if (content) {
        notesData.push({ content });
        localStorage.setItem("notes", JSON.stringify(notesData));
        renderNotes();
    }
});

// Edit a note
function editNote(index) {
    const note = notesData[index];
    const newContent = prompt("Edit your note:", note.content);
    if (newContent) {
        notesData[index].content = newContent;
        localStorage.setItem("notes", JSON.stringify(notesData));
        renderNotes();
    }
}

// Remove a note
function removeNote(index) {
    notesData.splice(index, 1);
    localStorage.setItem("notes", JSON.stringify(notesData));
    renderNotes();
}

// Initialize the notes section
renderNotes();

// Handle Media Upload
const mediaUpload = document.getElementById("media-upload");
const mediaPreview = document.getElementById("media-preview");

mediaUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            mediaPreview.innerHTML = file.type.startsWith("image")
                ? `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; height: auto;">`
                : `<video controls style="max-width: 100%; height: auto;"><source src="${e.target.result}" type="${file.type}"></video>`;
        };
        reader.readAsDataURL(file);
    }
});

// Clear Media Preview
document.getElementById("clear-media").addEventListener("click", () => {
    mediaUpload.value = "";
    mediaPreview.innerHTML = "";
});
// Remove a student
function removeStudent(index) {
    if (index >= 0 && index < studentData.length) {
        studentData.splice(index, 1); // Remove the student at the given index
        localStorage.setItem("students", JSON.stringify(studentData)); // Update local storage
        renderStudents(); // Re-render the student table
    } else {
        console.error("Invalid index for deletion");
    }
}
// Render student data
function renderStudents() {
    const tableBody = document.querySelector("#student-table tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    studentData.forEach((student, index) => {
        if (student) { // Ensure the student exists
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${student.name || "Unnamed"}</td>
                <td>${student.paymentType || "Not Specified"}</td>
                <td>${student.date || "N/A"}</td>
                <td>${student.status ? "Paid" : "Unpaid"}</td>
                <td>
                    <button onclick="editStudent(${index})">Edit</button>
                    <button onclick="removeStudent(${index})">Remove</button>
                </td>
            `;
            tableBody.appendChild(row);
        }
    });
}

// Edit a student
function editStudent(index) {
    if (index >= 0 && index < studentData.length) {
        const student = studentData[index];

        const newName = prompt("Edit name:", student.name || "Unnamed");
        const newPaymentType = prompt("Edit payment type (e.g., manual/book):", student.paymentType || "Not Specified");
        const newDate = prompt("Edit date (format: MM/DD/YYYY):", student.date || new Date().toLocaleDateString());
        const newStatus = confirm("Mark as Paid? (OK = Paid, Cancel = Unpaid)");

        // Update student details
        studentData[index] = {
            name: newName || student.name, // Retain old value if input is empty
            paymentType: newPaymentType || student.paymentType,
            date: newDate || student.date,
            status: newStatus,
        };

        localStorage.setItem("students", JSON.stringify(studentData)); // Update local storage
        renderStudents(); // Re-render the student table
    } else {
        console.error("Invalid index for editing");
    }
}
// Render student data
function renderStudents() {
    const tableBody = document.querySelector("#student-table tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    studentData.forEach((student, index) => {
        if (student) { // Ensure the student exists
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${student.name || "Unnamed"}</td>
                <td>${student.paymentType || "Not Specified"}</td>
                <td>${student.date || "N/A"}</td>
                <td>${student.status ? "Paid" : "Unpaid"}</td>
                <td>
                    <button onclick="editStudent(${index})">Edit</button>
                    <button onclick="removeStudent(${index})">Remove</button>
                </td>
            `;
            tableBody.appendChild(row);
        }
    });
}

// Document-related data
const documents = JSON.parse(localStorage.getItem('documents')) || [];

// Get modal elements
const documentModal = document.getElementById("document-modal");
const modalTitle = document.getElementById("modal-title");
const documentTextarea = document.getElementById("document-textarea");
const documentList = document.getElementById("document-list");
const closeModal = document.querySelector(".close-modal");

// Open "Save Document" modal
document.getElementById("save-doc-btn").addEventListener("click", () => {
    modalTitle.textContent = "Save a New Document";
    documentTextarea.style.display = "block"; // Show the textarea
    documentTextarea.value = ""; // Clear previous content
    documentList.style.display = "none"; // Hide the list
    documentModal.style.display = "block";
});

// Open "View Documents" modal
document.getElementById("view-doc-btn").addEventListener("click", () => {
    modalTitle.textContent = "View Saved Documents";
    documentTextarea.style.display = "none"; // Hide the textarea
    documentList.style.display = "block"; // Show the list
    renderDocumentList();
    documentModal.style.display = "block";
});

// Close modal
closeModal.addEventListener("click", () => {
    documentModal.style.display = "none";
});

// Save document action
document.getElementById("save-document-action").addEventListener("click", () => {
    const text = documentTextarea.value.trim();
    if (text) {
        documents.push(text);
        localStorage.setItem("documents", JSON.stringify(documents));
        alert("Document saved successfully!");
        documentModal.style.display = "none";
    } else {
        alert("Document content cannot be empty!");
    }
});

// Render document list
function renderDocumentList() {
    documentList.innerHTML = ""; // Clear current list
    documents.forEach((doc, index) => {
        const listItem = document.createElement("li");
        listItem.textContent = doc;

        // Add a delete button for each document
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.style.marginLeft = "10px";
        deleteButton.addEventListener("click", () => deleteDocument(index));

        listItem.appendChild(deleteButton);
        documentList.appendChild(listItem);
    });
}

// Delete a document
function deleteDocument(index) {
    documents.splice(index, 1);
    localStorage.setItem("documents", JSON.stringify(documents));
    renderDocumentList();
}

// Media-related data
const savedMedia = JSON.parse(localStorage.getItem("savedMedia")) || [];

// Save uploaded media
document.getElementById("save-media-btn").addEventListener("click", () => {
    const mediaUpload = document.getElementById("media-upload");
    const file = mediaUpload.files[0];

    if (!file) {
        alert("No media selected to save!");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        // Save media path
        savedMedia.push({ type: file.type, src: reader.result });
        localStorage.setItem("savedMedia", JSON.stringify(savedMedia));

        alert("Media saved successfully!");
        renderSavedMedia(); // Update the list of saved media
    };
    reader.readAsDataURL(file);
});

// Render saved media list
function renderSavedMedia() {
    const savedMediaList = document.getElementById("saved-media-list");
    savedMediaList.innerHTML = ""; // Clear the current list

    savedMedia.forEach((media, index) => {
        const listItem = document.createElement("li");

        listItem.innerHTML = media.type.startsWith("image")
            ? `<img src="${media.src}" alt="Saved Media" style="max-width: 100px; height: auto;">`
            : `<video controls style="max-width: 100px; height: auto;"><source src="${media.src}" type="${media.type}"></video>`;

        // Add delete button for each saved media
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.style.marginLeft = "10px";
        deleteButton.addEventListener("click", () => deleteSavedMedia(index));

        listItem.appendChild(deleteButton);
        savedMediaList.appendChild(listItem);
    });
}

// Delete a saved media item
function deleteSavedMedia(index) {
    savedMedia.splice(index, 1); // Remove the media from the list
    localStorage.setItem("savedMedia", JSON.stringify(savedMedia));
    renderSavedMedia();
}

// Initialize saved media on page load
renderSavedMedia();

// Check local storage for the student's name
const studentName = localStorage.getItem("studentName");

// Modal Elements
const nameModal = document.getElementById("name-modal");
const welcomeModal = document.getElementById("welcome-modal");
const studentNameInput = document.getElementById("student-name");
const saveNameBtn = document.getElementById("save-name-btn");
const welcomeTitle = document.getElementById("welcome-title");
const welcomeMessage = document.getElementById("welcome-message");
const closeWelcomeBtn = document.getElementById("close-welcome-btn");

// Show name input modal if name is not saved
if (!studentName) {
    nameModal.style.display = "block";
} else {
    showWelcomeMessage(studentName);
}

// Save name and display welcome message
saveNameBtn.addEventListener("click", () => {
    const name = studentNameInput.value.trim();
    if (name) {
        localStorage.setItem("studentName", name);
        nameModal.style.display = "none";
        showWelcomeMessage(name);
    } else {
        alert("Please enter your full name.");
    }
});

// Display welcome modal with personalized message
function showWelcomeMessage(name) {
    welcomeTitle.textContent = `Welcome, ${name}!`;
    welcomeMessage.textContent = "Thank you for using Class Assistant. Let's make learning fun and productive!";
    welcomeModal.style.display = "block";
}

// Close the welcome modal
closeWelcomeBtn.addEventListener("click", () => {
    welcomeModal.style.display = "none";
});

// Star Rain Container
const starRainContainer = document.createElement("div");
starRainContainer.id = "star-rain";
document.body.appendChild(starRainContainer);

// Function to create a single star
function createStar() {
    const star = document.createElement("div");
    star.classList.add("star");

    // Randomize position and animation duration
    star.style.left = `${Math.random() * 100}vw`;
    star.style.animationDuration = `${Math.random() * 2 + 3}s`; // Between 3-5 seconds
    star.style.animationDelay = `${Math.random() * 1}s`; // Up to 1 second delay

    // Append the star to the container
    starRainContainer.appendChild(star);

    // Remove the star after animation ends
    star.addEventListener("animationend", () => {
        star.remove();
    });
}

// Function to trigger star rain
function triggerStarRain() {
    const starInterval = setInterval(() => {
        createStar();
    }, 100); // Create a star every 100ms

    // Stop creating stars after 5 seconds
    setTimeout(() => {
        clearInterval(starInterval);
    }, 5000);
}

// Close Welcome Modal with Star Rain
closeWelcomeBtn.addEventListener("click", () => {
    welcomeModal.style.display = "none";
    triggerStarRain();
});

const RSS_FEED_URL = "https://rss.nytimes.com/services/xml/rss/nyt/World.xml";

// Fetch RSS feed
async function fetchRSS() {
    try {
        const response = await fetch(RSS_FEED_URL);
        const text = await response.text();

        // Parse XML and extract headlines
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const items = xml.querySelectorAll("item > title");

        const headlines = Array.from(items).map((item) => item.textContent);
        displayNews(headlines);
    } catch (error) {
        console.error("Failed to fetch RSS feed:", error);
        displayNews([defaultMessage]);
    }
}

// Initialize RSS feed
fetchRSS();

// Array of Fun Facts
const funFacts = [
    "Did you know? The Eiffel Tower can be 15 cm taller during hot days!",
    "Fun Fact: Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs.",
    "Did you know? Octopuses have three hearts!",
    "Fun Fact: A group of flamingos is called a 'flamboyance'!",
    "Did you know? Bananas are berries, but strawberries aren't!",
    "Fun Fact: Your heart beats about 100,000 times a day.",
    "Did you know? The inventor of the Pringles can is buried in one!"
];

// Display a random fun fact
function displayRandomFact() {
    const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
    document.getElementById("fun-fact").textContent = randomFact;
}

// Hide splash screen after 3 seconds
function hideSplashScreen() {
    const splashScreen = document.getElementById("splash-screen");
    setTimeout(() => {
        splashScreen.style.display = "none"; // Hide the splash screen
    }, 3000);
}

// Initialize Splash Screen
function initSplashScreen() {
    displayRandomFact(); // Show a fun fact
    hideSplashScreen(); // Hide the splash screen after a delay
}

// Call splash screen initialization on page load
window.onload = initSplashScreen;