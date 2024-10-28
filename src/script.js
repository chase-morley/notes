class NotesApp {
    constructor() {
        document.addEventListener('DOMContentLoaded', () => {
            // Add try-catch for JSON parsing
            try {
                this.notes = JSON.parse(localStorage.getItem('notes')) || [];
            } catch (e) {
                console.error('Error loading notes:', e);
                this.notes = [];
            }

            // Add default values and null checks
            this.draggedNote = null;
            this.currentTheme = localStorage.getItem('theme') || 'light';
            this.searchOverlayVisible = false;
            this.addNoteOverlayVisible = false;
            this.activeFilters = {
                search: '',
                category: ''
            };
            this.deletedNote = null;
            this.toastTimeout = null;

            // Ensure theme is valid
            const validThemes = ['light', 'dark'];
            if (!validThemes.includes(this.currentTheme)) {
                this.currentTheme = 'light';
            }

            document.documentElement.setAttribute('data-theme', this.currentTheme);
            this.init();
        });
    }

    init() {
        // Select elements and log them to find which one is null
        const elements = {
            addNoteOverlay: document.getElementById('addNoteOverlay'),
            noteInput: document.getElementById('noteInput'),
            addNoteBtn: document.getElementById('addNote'),
            notesContainer: document.getElementById('notesContainer'),
            searchInput: document.getElementById('searchInput'),
            categoryFilter: document.getElementById('categoryFilter'),
            tagInput: document.getElementById('tagInput'),
            noteColor: document.getElementById('noteColor'),
            themeToggle: document.getElementById('themeToggle'),
            searchToggle: document.getElementById('searchToggle'),
            searchOverlay: document.getElementById('searchOverlay'),
            activeFiltersContainer: document.getElementById('activeFilters'),
            addNoteToggle: document.getElementById('addNoteToggle')
        };

        // Log all elements to find which one is null
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.error(`Missing element: ${name}`);
            }
        });

        // Assign elements to class properties
        Object.assign(this, elements);

        // Add event listeners using the safe method
        this.addSafeEventListener('addNote', 'click', () => this.addNote());
        this.addSafeEventListener('themeToggle', 'click', () => this.toggleTheme());
        this.addSafeEventListener('searchToggle', 'click', () => this.toggleSearchOverlay());
        this.addSafeEventListener('addNoteToggle', 'click', () => this.toggleAddNoteOverlay());

        // Add overlay click handlers
        this.addSafeEventListener('searchOverlay', 'click', (e) => {
            if (e.target.id === 'searchOverlay') this.toggleSearchOverlay();
        });

        this.addSafeEventListener('addNoteOverlay', 'click', (e) => {
            if (e.target.id === 'addNoteOverlay') this.toggleAddNoteOverlay();
        });

        this.addSafeEventListener('editOverlay', 'click', (e) => {
            if (e.target.id === 'editOverlay') e.target.style.display = 'none';
        });

        // Add input handlers
        this.addSafeEventListener('searchInput', 'input', () => {
            this.activeFilters.search = this.searchInput.value.trim();
            this.updateActiveFilters();
            this.filterNotes();
        });

        this.addSafeEventListener('categoryFilter', 'change', () => {
            this.activeFilters.category = this.categoryFilter.value;
            this.updateActiveFilters();
            this.filterNotes();
        });

        this.renderNotes();
        this.setupDragAndDrop();
        this.updateCategories();
    }

    setupDragAndDrop() {
        this.notesContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingNote = document.querySelector('.dragging');
            const notDraggingNotes = [...this.notesContainer.querySelectorAll('.note:not(.dragging)')];
            
            const closestNote = notDraggingNotes.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;

            if (closestNote) {
                this.notesContainer.insertBefore(draggingNote, closestNote);
            } else {
                this.notesContainer.appendChild(draggingNote);
            }
        });
    }

    createNoteElement(note, index) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note';
        noteDiv.draggable = true;
        noteDiv.dataset.index = index;
        
        const noteText = note.text || '';
        const tags = note.tags ? note.tags.map(tag => 
            `<span class="tag">${tag}</span>`).join('') : '';

        noteDiv.innerHTML = `
            <div class="color-band" style="background-color: ${note.color || '#3498db'}"></div>
            <div class="note-content-wrapper">
                <div class="note-content" style="white-space: pre-wrap">${marked.parse(noteText)}</div>
                <div class="tags">${tags}</div>
            </div>
            <div class="note-actions">
                <button class="edit-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="delete-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;

        // Add drag events
        noteDiv.addEventListener('dragstart', () => {
            noteDiv.classList.add('dragging');
            this.draggedNote = index;
        });

        noteDiv.addEventListener('dragend', () => {
            noteDiv.classList.remove('dragging');
            this.updateNotesOrder();
        });

        // Add button events
        noteDiv.querySelector('.delete-btn').addEventListener('click', () => this.deleteNote(index));
        noteDiv.querySelector('.edit-btn').addEventListener('click', () => this.editNote(index));

        return noteDiv;
    }

    renderNotes() {
        this.notesContainer.innerHTML = '';
        this.notes.forEach((note, index) => {
            const noteElement = this.createNoteElement(note, index);
            this.notesContainer.appendChild(noteElement);
        });
    }

    addNote() {
        const noteText = this.noteInput.value.trim();
        console.log('Adding note with text:', noteText);
        
        // Add null checks and default values
        const tags = this.tagInput?.value ? this.tagInput.value.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0) : [];
        
        if (noteText) {
            const newNote = {
                text: noteText,
                tags: tags,
                color: this.noteColor?.value || '#ffffff',
                createdAt: new Date().toISOString()
            };
            
            this.notes.push(newNote);
            this.saveNotes();
            this.noteInput.value = '';
            if (this.tagInput) this.tagInput.value = '';
            if (this.noteColor) this.noteColor.value = '#ffffff';
            this.renderNotes();
            this.updateCategories(); // Update categories after adding a note
            this.toggleAddNoteOverlay(); // Close overlay after adding note
        } else {
            console.log('Note text is empty');
        }
    }

    deleteNote(index) {
        // Store the deleted note before removing it
        this.deletedNote = {
            note: this.notes[index],
            index: index
        };
        
        // Remove the note
        this.notes.splice(index, 1);
        this.saveNotes();
        this.renderNotes();
        
        // Show toast notification
        this.showToast();
    }

    editNote(index) {
        const note = this.notes[index];
        const overlay = document.getElementById('editOverlay');
        const textArea = document.getElementById('editNoteText');
        const tagInput = document.getElementById('editTagInput');
        const colorInput = document.getElementById('editNoteColor');
        const cancelBtn = document.getElementById('cancelEdit');
        const saveBtn = document.getElementById('saveEdit');

        // Set current values
        textArea.value = note.text;
        tagInput.value = note.tags ? note.tags.join(', ') : '';
        colorInput.value = note.color || '#ffffff';

        // Show overlay
        overlay.style.display = 'flex';

        // Update the buttons HTML
        saveBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
        `;
        
        cancelBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
            </svg>
        `;

        // Handle cancel
        cancelBtn.onclick = () => {
            overlay.style.display = 'none';
        };

        // Handle save
        saveBtn.onclick = () => {
            note.text = textArea.value.trim();
            note.tags = tagInput.value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            note.color = colorInput.value;

            this.saveNotes();
            this.renderNotes();
            this.updateCategories();
            overlay.style.display = 'none';
        };
    }

    updateNotesOrder() {
        const noteElements = [...this.notesContainer.querySelectorAll('.note')];
        const newNotes = noteElements.map(noteEl => {
            return this.notes[parseInt(noteEl.dataset.index)];
        });
        this.notes = newNotes;
        this.saveNotes();
    }

    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    }

    filterNotes() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const categoryFilter = this.categoryFilter.value.toLowerCase();
        
        const filteredNotes = this.notes.filter(note => {
            const matchesSearch = note.text.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || 
                (note.tags && note.tags.some(tag => 
                    tag.toLowerCase() === categoryFilter));
            return matchesSearch && matchesCategory;
        });

        this.renderFilteredNotes(filteredNotes);
    }

    renderFilteredNotes(filteredNotes) {
        this.notesContainer.innerHTML = '';
        filteredNotes.forEach((note, index) => {
            const noteElement = this.createNoteElement(note, 
                this.notes.indexOf(note));
            this.notesContainer.appendChild(noteElement);
        });
    }

    updateCategories() {
        const categories = new Set();
        this.notes.forEach(note => {
            if (note.tags) {
                note.tags.forEach(tag => categories.add(tag));
            }
        });

        // Clear existing options except the default "All Categories"
        this.categoryFilter.innerHTML = '<option value="">All Categories</option>';
        
        // Add all unique categories
        Array.from(categories).sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            this.categoryFilter.appendChild(option);
        });
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
    }

    updateActiveFilters() {
        const hasFilters = this.activeFilters.search || this.activeFilters.category;
        this.activeFiltersContainer.classList.toggle('visible', hasFilters);
        
        if (!hasFilters) {
            this.activeFiltersContainer.innerHTML = '';
            return;
        }

        let filtersHTML = '';
        
        if (this.activeFilters.search) {
            filtersHTML += `
                <div class="filter-tag">
                    Search: ${this.activeFilters.search}
                    <button onclick="app.clearFilter('search')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;
        }
        
        if (this.activeFilters.category) {
            filtersHTML += `
                <div class="filter-tag">
                    Category: ${this.activeFilters.category}
                    <button onclick="app.clearFilter('category')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;
        }
        
        this.activeFiltersContainer.innerHTML = filtersHTML;
    }

    clearFilter(type) {
        if (type === 'search') {
            this.searchInput.value = '';
            this.activeFilters.search = '';
        } else if (type === 'category') {
            this.categoryFilter.value = '';
            this.activeFilters.category = '';
        }
        
        this.updateActiveFilters();
        this.filterNotes();
    }

    toggleSearchOverlay() {
        this.searchOverlayVisible = !this.searchOverlayVisible;
        this.handleOverlay('searchOverlay', this.searchOverlayVisible, () => {
            this.updateCategories();
            this.searchInput.focus();
        });
    }

    toggleAddNoteOverlay() {
        this.addNoteOverlayVisible = !this.addNoteOverlayVisible;
        this.handleOverlay('addNoteOverlay', this.addNoteOverlayVisible, () => {
            if (this.addNoteOverlayVisible) {
                this.noteInput.focus();
            } else {
                this.noteInput.value = '';
                this.tagInput.value = '';
                this.noteColor.value = '#ffffff';
            }
        });
    }

    handleOverlay(overlayId, isVisible, callback = null) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        
        overlay.style.display = isVisible ? 'flex' : 'none';
        if (isVisible && callback) callback();
    }

    addSafeEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    showToast() {
        // Clear any existing timeout
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        // Create or get toast container
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <span>Note deleted</span>
            <button class="undo-btn" title="Undo delete">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path clip-rule="evenodd" d="M7.53033 3.46967C7.82322 3.76256 7.82322 4.23744 7.53033 4.53033L5.81066 6.25H15C18.1756 6.25 20.75 8.82436 20.75 12C20.75 15.1756 18.1756 17.75 15 17.75H8.00001C7.58579 17.75 7.25001 17.4142 7.25001 17C7.25001 16.5858 7.58579 16.25 8.00001 16.25H15C17.3472 16.25 19.25 14.3472 19.25 12C19.25 9.65279 17.3472 7.75 15 7.75H5.81066L7.53033 9.46967C7.82322 9.76256 7.82322 10.2374 7.53033 10.5303C7.23744 10.8232 6.76256 10.8232 6.46967 10.5303L3.46967 7.53033C3.17678 7.23744 3.17678 6.76256 3.46967 6.46967L6.46967 3.46967C6.76256 3.17678 7.23744 3.17678 7.53033 3.46967Z"/>
                </svg>
            </button>
        `;

        // Add undo functionality
        const undoBtn = toast.querySelector('.undo-btn');
        undoBtn.addEventListener('click', () => this.undoDelete());

        // Handle hover to prevent fade
        toast.addEventListener('mouseenter', () => {
            if (this.toastTimeout) {
                clearTimeout(this.toastTimeout);
            }
            toast.classList.remove('fade');
        });

        toast.addEventListener('mouseleave', () => {
            this.startToastTimeout(toast);
        });

        // Remove existing toast if any
        const existingToast = container.querySelector('.toast');
        if (existingToast) {
            container.removeChild(existingToast);
        }

        // Add and animate new toast
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Start fade timeout
        this.startToastTimeout(toast);
    }

    startToastTimeout(toast) {
        this.toastTimeout = setTimeout(() => {
            toast.classList.add('fade');
            setTimeout(() => {
                toast.remove();
                this.deletedNote = null;
            }, 300);
        }, 3000);
    }

    undoDelete() {
        if (this.deletedNote) {
            // Insert the note back at its original position
            this.notes.splice(this.deletedNote.index, 0, this.deletedNote.note);
            this.saveNotes();
            this.renderNotes();
            
            // Remove the toast
            const toast = document.querySelector('.toast');
            if (toast) {
                toast.remove();
            }
            
            this.deletedNote = null;
        }
    }
}

// Initialize the app
const app = new NotesApp();
