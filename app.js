// ============================================
// DATA MANAGEMENT
// ============================================

const STORAGE_KEY = 'splitwise_app_data';

/**
 * Generate a unique UUID string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Load data from localStorage
 */
function loadData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    return { trips: [] };
}

/**
 * Save data to localStorage
 */
function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Failed to save data. Please check your browser storage settings.');
        return false;
    }
}

// ============================================
// STATE MANAGEMENT
// ============================================

let currentTripId = null;
let selectedTripIds = new Set();

// ============================================
// TRIP MANAGEMENT
// ============================================

/**
 * Create a new trip
 */
function createTrip(name, budget) {
    if (!name || name.trim() === '') {
        alert('Trip name is required');
        return null;
    }

    const data = loadData();
    const trip = {
        id: generateUUID(),
        name: name.trim(),
        budget: budget ? parseFloat(budget) : null,
        persons: [],
        expenses: []
    };
    
    data.trips.push(trip);
    if (saveData(data)) {
        renderTripList();
        selectTrip(trip.id);
        return trip;
    }
    return null;
}

/**
 * Delete a trip by ID
 */
function deleteTrip(id) {
    const data = loadData();
    data.trips = data.trips.filter(trip => trip.id !== id);
    if (saveData(data)) {
        if (currentTripId === id) {
            currentTripId = null;
            renderTripDetails(null);
        }
        selectedTripIds.delete(id);
        renderTripList();
    }
}

/**
 * Bulk delete trips
 */
function bulkDeleteTrips(ids) {
    if (ids.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${ids.length} trip(s)?`)) {
        return;
    }

    const data = loadData();
    data.trips = data.trips.filter(trip => !ids.includes(trip.id));
    if (saveData(data)) {
        if (ids.includes(currentTripId)) {
            currentTripId = null;
            renderTripDetails(null);
        }
        selectedTripIds.clear();
        renderTripList();
    }
}

/**
 * Select a trip and render its details
 */
function selectTrip(id) {
    currentTripId = id;
    selectedTripIds.clear();
    renderTripList();
    renderTripDetails(id);
}

/**
 * Get trip by ID
 */
function getTrip(id) {
    const data = loadData();
    return data.trips.find(trip => trip.id === id);
}

// ============================================
// PERSON MANAGEMENT
// ============================================

/**
 * Add a person to a trip
 */
function addPersonToTrip(tripId, name) {
    if (!name || name.trim() === '') {
        alert('Person name is required');
        return null;
    }

    const data = loadData();
    const trip = data.trips.find(t => t.id === tripId);
    if (!trip) {
        alert('Trip not found');
        return null;
    }

    // Check for duplicate names
    if (trip.persons.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
        alert('A person with this name already exists in this trip');
        return null;
    }

    const person = {
        id: generateUUID(),
        name: name.trim()
    };

    trip.persons.push(person);
    if (saveData(data)) {
        renderTripDetails(tripId);
        return person;
    }
    return null;
}

/**
 * Delete a person from a trip
 */
function deletePerson(tripId, personId) {
    const data = loadData();
    const trip = data.trips.find(t => t.id === tripId);
    if (!trip) {
        alert('Trip not found');
        return false;
    }

    // Check if person is used in any expense
    const isUsedInExpense = trip.expenses.some(expense => 
        expense.paidBy === personId || expense.participants.includes(personId)
    );

    if (isUsedInExpense) {
        alert('Cannot delete person. They are involved in one or more expenses.');
        return false;
    }

    trip.persons = trip.persons.filter(p => p.id !== personId);
    if (saveData(data)) {
        renderTripDetails(tripId);
        return true;
    }
    return false;
}

/**
 * Get person count for a trip
 */
function getPersonCount(tripId) {
    const trip = getTrip(tripId);
    return trip ? trip.persons.length : 0;
}

// ============================================
// EXPENSE MANAGEMENT
// ============================================

/**
 * Add an expense to a trip
 */
function addExpense(tripId, expenseData) {
    const { title, amount, paidBy, participants } = expenseData;

    // Validation
    if (!title || title.trim() === '') {
        alert('Expense title is required');
        return null;
    }

    if (!amount || amount <= 0) {
        alert('Expense amount must be greater than 0');
        return null;
    }

    if (!paidBy) {
        alert('Please select who paid for this expense');
        return null;
    }

    if (!participants || participants.length === 0) {
        alert('Please select at least one participant');
        return null;
    }

    const data = loadData();
    const trip = data.trips.find(t => t.id === tripId);
    if (!trip) {
        alert('Trip not found');
        return null;
    }

    // Check if paidBy is in participants, if not, offer to add them
    if (!participants.includes(paidBy)) {
        const paidByPerson = trip.persons.find(p => p.id === paidBy);
        const paidByName = paidByPerson ? paidByPerson.name : 'the selected person';
        const addToParticipants = confirm(`${paidByName} is not selected as a participant. Would you like to add them as a participant?`);
        
        if (addToParticipants) {
            participants.push(paidBy);
        }
    }

    // Check minimum 2 persons
    if (trip.persons.length < 2) {
        alert('You need at least 2 persons in the trip before adding expenses');
        return null;
    }

    const expense = {
        id: generateUUID(),
        title: title.trim(),
        amount: parseFloat(amount),
        paidBy: paidBy,
        participants: participants,
        createdAt: Date.now()
    };

    trip.expenses.push(expense);
    if (saveData(data)) {
        renderTripDetails(tripId);
        return expense;
    }
    return null;
}

/**
 * Update an existing expense
 */
function updateExpense(tripId, expenseId, expenseData) {
    const { title, amount, paidBy, participants } = expenseData;

    // Validation
    if (!title || title.trim() === '') {
        alert('Expense title is required');
        return null;
    }

    if (!amount || amount <= 0) {
        alert('Expense amount must be greater than 0');
        return null;
    }

    if (!paidBy) {
        alert('Please select who paid for this expense');
        return null;
    }

    if (!participants || participants.length === 0) {
        alert('Please select at least one participant');
        return null;
    }

    const data = loadData();
    const trip = data.trips.find(t => t.id === tripId);
    if (!trip) {
        alert('Trip not found');
        return null;
    }

    const expense = trip.expenses.find(e => e.id === expenseId);
    if (!expense) {
        alert('Expense not found');
        return null;
    }

    // Check if paidBy is in participants, if not, offer to add them
    if (!participants.includes(paidBy)) {
        const paidByPerson = trip.persons.find(p => p.id === paidBy);
        const paidByName = paidByPerson ? paidByPerson.name : 'the selected person';
        const addToParticipants = confirm(`${paidByName} is not selected as a participant. Would you like to add them as a participant?`);
        
        if (addToParticipants) {
            participants.push(paidBy);
        }
    }

    // Update expense
    expense.title = title.trim();
    expense.amount = parseFloat(amount);
    expense.paidBy = paidBy;
    expense.participants = participants;

    if (saveData(data)) {
        renderTripDetails(tripId);
        return expense;
    }
    return null;
}

/**
 * Delete an expense from a trip
 */
function deleteExpense(tripId, expenseId) {
    const data = loadData();
    const trip = data.trips.find(t => t.id === tripId);
    if (!trip) {
        alert('Trip not found');
        return false;
    }

    const expense = trip.expenses.find(e => e.id === expenseId);
    if (!expense) {
        alert('Expense not found');
        return false;
    }

    trip.expenses = trip.expenses.filter(e => e.id !== expenseId);
    if (saveData(data)) {
        renderTripDetails(tripId);
        return true;
    }
    return false;
}

// ============================================
// SETTLEMENT CALCULATION
// ============================================

/**
 * Calculate balances for a trip
 * Algorithm:
 * 1. Initialize balance for each person = 0
 * 2. For each expense:
 *    - split = amount / participants.length
 *    - balance[paidBy] += amount
 *    - for each participant: balance[participant] -= split
 * 3. Round balances to 2 decimals
 */
function calculateBalances(trip) {
    if (!trip || !trip.persons || trip.persons.length === 0) {
        return {};
    }

    // Initialize balances
    const balances = {};
    trip.persons.forEach(person => {
        balances[person.id] = 0;
    });

    // Process each expense
    trip.expenses.forEach(expense => {
        const split = expense.amount / expense.participants.length;
        
        // Person who paid gets credited the full amount
        balances[expense.paidBy] += expense.amount;
        
        // Each participant owes their share
        expense.participants.forEach(participantId => {
            balances[participantId] -= split;
        });
    });

    // Round to 2 decimals
    Object.keys(balances).forEach(personId => {
        balances[personId] = Math.round(balances[personId] * 100) / 100;
    });

    return balances;
}

/**
 * Resolve settlements - who pays whom
 * Algorithm:
 * - Separate creditors (balance > 0) and debtors (balance < 0)
 * - Debtor pays creditor min(abs(debt), credit)
 * - Continue until all balances are zero
 */
function resolveSettlements(balances, persons) {
    const settlements = [];
    
    // Create a map of personId to name
    const personMap = {};
    persons.forEach(person => {
        personMap[person.id] = person.name;
    });

    // Create working copy of balances
    const workingBalances = { ...balances };

    // Separate creditors and debtors
    let creditors = [];
    let debtors = [];

    Object.keys(workingBalances).forEach(personId => {
        const balance = workingBalances[personId];
        if (balance > 0.01) { // Use small threshold to handle floating point
            creditors.push({ id: personId, amount: balance });
        } else if (balance < -0.01) {
            debtors.push({ id: personId, amount: Math.abs(balance) });
        }
    });

    // Sort by amount (descending for creditors, ascending for debtors)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Resolve payments
    while (creditors.length > 0 && debtors.length > 0) {
        const creditor = creditors[0];
        const debtor = debtors[0];

        const payment = Math.min(creditor.amount, debtor.amount);
        
        if (payment > 0.01) { // Only record significant payments
            settlements.push({
                from: debtor.id,
                to: creditor.id,
                amount: Math.round(payment * 100) / 100
            });
        }

        // Update balances
        creditor.amount -= payment;
        debtor.amount -= payment;

        // Remove if settled
        if (creditor.amount < 0.01) {
            creditors.shift();
        }
        if (debtor.amount < 0.01) {
            debtors.shift();
        }
    }

    return settlements;
}

// ============================================
// UI RENDERING
// ============================================

/**
 * Render the trip list in the sidebar
 */
function renderTripList() {
    const tripListEl = document.getElementById('tripList');
    const data = loadData();
    const trips = data.trips;

    tripListEl.innerHTML = '';

    if (trips.length === 0) {
        tripListEl.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary); text-align: center;">No trips yet</p>';
        return;
    }

    trips.forEach(trip => {
        const tripItem = document.createElement('div');
        tripItem.className = `trip-item ${trip.id === currentTripId ? 'active' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedTripIds.has(trip.id);
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedTripIds.add(trip.id);
            } else {
                selectedTripIds.delete(trip.id);
            }
            updateDeleteButtonState();
        });

        const nameSpan = document.createElement('span');
        nameSpan.className = 'trip-item-name';
        nameSpan.textContent = trip.name;
        nameSpan.addEventListener('click', () => selectTrip(trip.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'trip-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete trip';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${trip.name}"?`)) {
                deleteTrip(trip.id);
            }
        });

        tripItem.appendChild(checkbox);
        tripItem.appendChild(nameSpan);
        tripItem.appendChild(deleteBtn);
        tripListEl.appendChild(tripItem);
    });

    updateDeleteButtonState();
}

/**
 * Update delete button state based on selection
 */
function updateDeleteButtonState() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    deleteBtn.disabled = selectedTripIds.size === 0;
}

/**
 * Render trip details in main content
 */
function renderTripDetails(tripId) {
    const emptyState = document.getElementById('emptyState');
    const tripDetails = document.getElementById('tripDetails');

    if (!tripId) {
        emptyState.style.display = 'block';
        tripDetails.style.display = 'none';
        return;
    }

    const trip = getTrip(tripId);
    if (!trip) {
        emptyState.style.display = 'block';
        tripDetails.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    tripDetails.style.display = 'block';

    // Update trip name
    document.getElementById('tripName').textContent = trip.name;

    // Render persons
    renderPersonsList(trip);

    // Render expenses
    renderExpensesList(trip);

    // Render expense summary
    renderExpenseSummary(trip);

    // Render settlement
    renderSettlement(trip);

    // Render consolidated tab (settlement, summary, expenses)
    renderConsolidatedTab(trip);
}

/**
 * Render persons list
 */
function renderPersonsList(trip) {
    const personsListEl = document.getElementById('personsList');
    personsListEl.innerHTML = '';

    if (trip.persons.length === 0) {
        personsListEl.innerHTML = '<p style="color: var(--text-secondary);">No persons added yet</p>';
        return;
    }

    trip.persons.forEach(person => {
        const personTag = document.createElement('div');
        personTag.className = 'person-tag';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = person.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'person-tag-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete person';
        deleteBtn.addEventListener('click', () => {
            deletePerson(trip.id, person.id);
        });

        personTag.appendChild(nameSpan);
        personTag.appendChild(deleteBtn);
        personsListEl.appendChild(personTag);
    });
}

/**
 * Render expenses list as a table
 */
function renderExpensesList(trip) {
    const expensesListEl = document.getElementById('expensesList');
    const expensesTable = document.getElementById('expensesTable');
    const expensesEmpty = document.getElementById('expensesEmpty');
    
    expensesListEl.innerHTML = '';

    if (trip.expenses.length === 0) {
        expensesTable.style.display = 'none';
        expensesEmpty.style.display = 'block';
        return;
    }

    expensesTable.style.display = 'table';
    expensesEmpty.style.display = 'none';

    // Sort expenses by creation date (newest first)
    const sortedExpenses = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt);

    sortedExpenses.forEach(expense => {
        const row = document.createElement('tr');
        row.className = 'expense-row';

        const paidByPerson = trip.persons.find(p => p.id === expense.paidBy);
        const participantNames = expense.participants
            .map(id => trip.persons.find(p => p.id === id)?.name)
            .filter(Boolean);
        const perPersonAmount = expense.amount / expense.participants.length;

        // Title cell (clickable to view details)
        const titleCell = document.createElement('td');
        const titleLink = document.createElement('a');
        titleLink.href = '#';
        titleLink.style.cursor = 'pointer';
        titleLink.style.color = 'var(--primary-color)';
        titleLink.style.textDecoration = 'none';
        titleLink.style.fontWeight = '500';
        titleLink.textContent = expense.title;
        titleLink.addEventListener('click', (e) => {
            e.preventDefault();
            showExpenseDetails(trip, expense);
        });
        titleCell.appendChild(titleLink);

        // Amount cell
        const amountCell = document.createElement('td');
        amountCell.textContent = `₹${expense.amount.toFixed(2)}`;
        amountCell.style.fontWeight = '600';
        amountCell.style.color = 'var(--primary-color)';

        // Paid By cell
        const paidByCell = document.createElement('td');
        paidByCell.textContent = paidByPerson?.name || 'Unknown';

        // Participants cell
        const participantsCell = document.createElement('td');
        participantsCell.textContent = participantNames.join(', ');

        // Per Person cell
        const perPersonCell = document.createElement('td');
        perPersonCell.textContent = `₹${perPersonAmount.toFixed(2)}`;

        // Actions cell
        const actionsCell = document.createElement('td');
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '0.5rem';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-secondary';
        viewBtn.style.padding = '0.4rem 0.8rem';
        viewBtn.style.fontSize = '0.85rem';
        viewBtn.textContent = 'View';
        viewBtn.title = 'View details';
        viewBtn.addEventListener('click', () => {
            showExpenseDetails(trip, expense);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary';
        editBtn.style.padding = '0.4rem 0.8rem';
        editBtn.style.fontSize = '0.85rem';
        editBtn.textContent = 'Edit';
        editBtn.title = 'Edit expense';
        editBtn.addEventListener('click', () => {
            openEditExpenseModal(trip.id, expense);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.style.padding = '0.4rem 0.8rem';
        deleteBtn.style.fontSize = '0.85rem';
        deleteBtn.textContent = 'Delete';
        deleteBtn.title = 'Delete expense';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete expense "${expense.title}"?`)) {
                deleteExpense(trip.id, expense.id);
            }
        });

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        actionsCell.appendChild(actions);

        row.appendChild(titleCell);
        row.appendChild(amountCell);
        row.appendChild(paidByCell);
        row.appendChild(participantsCell);
        row.appendChild(perPersonCell);
        row.appendChild(actionsCell);
        
        expensesListEl.appendChild(row);
    });
}

/**
 * Render expense summary table
 */
function renderExpenseSummary(trip) {
    const tbody = document.getElementById('expenseSummaryBody');
    tbody.innerHTML = '';

    if (trip.persons.length === 0) {
        return;
    }

    const balances = calculateBalances(trip);
    
    // Calculate totals
    let totalPaid = {};
    let totalShare = {};
    
    trip.persons.forEach(person => {
        totalPaid[person.id] = 0;
        totalShare[person.id] = 0;
    });

    trip.expenses.forEach(expense => {
        const split = expense.amount / expense.participants.length;
        totalPaid[expense.paidBy] += expense.amount;
        expense.participants.forEach(participantId => {
            totalShare[participantId] += split;
        });
    });

    // Round totals
    Object.keys(totalPaid).forEach(id => {
        totalPaid[id] = Math.round(totalPaid[id] * 100) / 100;
        totalShare[id] = Math.round(totalShare[id] * 100) / 100;
    });

    trip.persons.forEach(person => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = person.name;
        
        const paidCell = document.createElement('td');
        paidCell.textContent = `₹${totalPaid[person.id].toFixed(2)}`;
        
        const shareCell = document.createElement('td');
        shareCell.textContent = `₹${totalShare[person.id].toFixed(2)}`;
        
        const balanceCell = document.createElement('td');
        const balance = balances[person.id] || 0;
        balanceCell.textContent = `₹${balance.toFixed(2)}`;
        
        if (balance > 0.01) {
            balanceCell.className = 'balance-positive';
        } else if (balance < -0.01) {
            balanceCell.className = 'balance-negative';
        } else {
            balanceCell.className = 'balance-zero';
        }
        
        row.appendChild(nameCell);
        row.appendChild(paidCell);
        row.appendChild(shareCell);
        row.appendChild(balanceCell);
        tbody.appendChild(row);
    });

    // Verify sum of balances equals 0
    const sum = Object.values(balances).reduce((a, b) => a + b, 0);
    if (Math.abs(sum) > 0.01) {
        console.warn('Balance sum is not zero:', sum);
    }
}

/**
 * Render settlement table
 */
function renderSettlement(trip) {
    const settlementBody = document.getElementById('settlementBody');
    const noSettlement = document.getElementById('noSettlement');
    const settlementTable = document.getElementById('settlementTable');

    settlementBody.innerHTML = '';

    if (trip.persons.length === 0) {
        settlementTable.style.display = 'none';
        noSettlement.style.display = 'block';
        return;
    }

    const balances = calculateBalances(trip);
    const settlements = resolveSettlements(balances, trip.persons);

    if (settlements.length === 0) {
        settlementTable.style.display = 'none';
        noSettlement.style.display = 'block';
        return;
    }

    settlementTable.style.display = 'table';
    noSettlement.style.display = 'none';

    const personMap = {};
    trip.persons.forEach(person => {
        personMap[person.id] = person.name;
    });

    settlements.forEach(settlement => {
        const row = document.createElement('tr');
        
        const fromCell = document.createElement('td');
        fromCell.textContent = personMap[settlement.from] || 'Unknown';
        
        const toCell = document.createElement('td');
        toCell.textContent = personMap[settlement.to] || 'Unknown';
        
        const amountCell = document.createElement('td');
        amountCell.textContent = `₹${settlement.amount.toFixed(2)}`;
        amountCell.className = 'balance-negative';
        
        row.appendChild(fromCell);
        row.appendChild(toCell);
        row.appendChild(amountCell);
        settlementBody.appendChild(row);
    });
}

/**
 * Render consolidated tab with settlement, summary, and expenses
 */
function renderConsolidatedTab(trip) {
    // Calculate total amount spent
    const totalAmountSpent = trip.expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Render trip info header
    const consolidatedTripName = document.getElementById('consolidatedTripName');
    const consolidatedTripDate = document.getElementById('consolidatedTripDate');
    const consolidatedTripBudget = document.getElementById('consolidatedTripBudget');
    
    if (consolidatedTripName) {
        consolidatedTripName.textContent = trip.name;
    }
    
    if (consolidatedTripDate) {
        consolidatedTripDate.textContent = new Date().toLocaleDateString();
    }
    
    if (consolidatedTripBudget) {
        consolidatedTripBudget.style.display = 'block';
        const budgetLabel = consolidatedTripBudget.querySelector('strong');
        const budgetSpan = consolidatedTripBudget.querySelector('span span');
        
        if (budgetLabel && budgetSpan) {
            if (trip.budget) {
                budgetLabel.textContent = 'Budget: ';
                budgetSpan.textContent = `₹${trip.budget.toFixed(2)} (Amount Spent: ₹${totalAmountSpent.toFixed(2)})`;
            } else {
                budgetLabel.textContent = 'Amount Spent: ';
                budgetSpan.textContent = `₹${totalAmountSpent.toFixed(2)}`;
            }
        }
    }

    // Render settlement for consolidated tab
    const settlementBodyConsolidated = document.getElementById('settlementBodyConsolidated');
    const noSettlementConsolidated = document.getElementById('noSettlementConsolidated');
    const settlementTableConsolidated = document.getElementById('settlementTableConsolidated');

    if (settlementBodyConsolidated) {
        settlementBodyConsolidated.innerHTML = '';

        if (trip.persons.length === 0) {
            if (settlementTableConsolidated) settlementTableConsolidated.style.display = 'none';
            if (noSettlementConsolidated) noSettlementConsolidated.style.display = 'block';
        } else {
            const balances = calculateBalances(trip);
            const settlements = resolveSettlements(balances, trip.persons);

            if (settlements.length === 0) {
                if (settlementTableConsolidated) settlementTableConsolidated.style.display = 'none';
                if (noSettlementConsolidated) noSettlementConsolidated.style.display = 'block';
            } else {
                if (settlementTableConsolidated) settlementTableConsolidated.style.display = 'table';
                if (noSettlementConsolidated) noSettlementConsolidated.style.display = 'none';

                const personMap = {};
                trip.persons.forEach(person => {
                    personMap[person.id] = person.name;
                });

                settlements.forEach(settlement => {
                    const row = document.createElement('tr');
                    
                    const fromCell = document.createElement('td');
                    fromCell.textContent = personMap[settlement.from] || 'Unknown';
                    
                    const toCell = document.createElement('td');
                    toCell.textContent = personMap[settlement.to] || 'Unknown';
                    
                    const amountCell = document.createElement('td');
                    amountCell.textContent = `₹${settlement.amount.toFixed(2)}`;
                    amountCell.className = 'balance-negative';
                    
                    row.appendChild(fromCell);
                    row.appendChild(toCell);
                    row.appendChild(amountCell);
                    settlementBodyConsolidated.appendChild(row);
                });
            }
        }
    }

    // Render expense summary for consolidated tab
    const tbodyConsolidated = document.getElementById('expenseSummaryBodyConsolidated');
    if (tbodyConsolidated) {
        tbodyConsolidated.innerHTML = '';

        if (trip.persons.length === 0) {
            return;
        }

        const balances = calculateBalances(trip);
        
        // Calculate totals
        let totalPaid = {};
        let totalShare = {};
        
        trip.persons.forEach(person => {
            totalPaid[person.id] = 0;
            totalShare[person.id] = 0;
        });

        trip.expenses.forEach(expense => {
            const split = expense.amount / expense.participants.length;
            totalPaid[expense.paidBy] += expense.amount;
            expense.participants.forEach(participantId => {
                totalShare[participantId] += split;
            });
        });

        // Round totals
        Object.keys(totalPaid).forEach(id => {
            totalPaid[id] = Math.round(totalPaid[id] * 100) / 100;
            totalShare[id] = Math.round(totalShare[id] * 100) / 100;
        });

        trip.persons.forEach(person => {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.textContent = person.name;
            
            const paidCell = document.createElement('td');
            paidCell.textContent = `₹${totalPaid[person.id].toFixed(2)}`;
            
            const shareCell = document.createElement('td');
            shareCell.textContent = `₹${totalShare[person.id].toFixed(2)}`;
            
            const balanceCell = document.createElement('td');
            const balance = balances[person.id] || 0;
            balanceCell.textContent = `₹${balance.toFixed(2)}`;
            
            if (balance > 0.01) {
                balanceCell.className = 'balance-positive';
            } else if (balance < -0.01) {
                balanceCell.className = 'balance-negative';
            } else {
                balanceCell.className = 'balance-zero';
            }
            
            row.appendChild(nameCell);
            row.appendChild(paidCell);
            row.appendChild(shareCell);
            row.appendChild(balanceCell);
            tbodyConsolidated.appendChild(row);
        });
    }

    // Render expenses for consolidated tab
    const expensesListConsolidated = document.getElementById('expensesListConsolidated');
    const expensesTableConsolidated = document.getElementById('expensesTableConsolidated');
    const expensesEmptyConsolidated = document.getElementById('expensesEmptyConsolidated');
    
    if (expensesListConsolidated) {
        expensesListConsolidated.innerHTML = '';

        if (trip.expenses.length === 0) {
            if (expensesTableConsolidated) expensesTableConsolidated.style.display = 'none';
            if (expensesEmptyConsolidated) expensesEmptyConsolidated.style.display = 'block';
        } else {
            if (expensesTableConsolidated) expensesTableConsolidated.style.display = 'table';
            if (expensesEmptyConsolidated) expensesEmptyConsolidated.style.display = 'none';

            // Sort expenses by creation date (newest first)
            const sortedExpenses = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt);

            sortedExpenses.forEach(expense => {
                const row = document.createElement('tr');
                row.className = 'expense-row';

                const paidByPerson = trip.persons.find(p => p.id === expense.paidBy);
                const participantNames = expense.participants
                    .map(id => trip.persons.find(p => p.id === id)?.name)
                    .filter(Boolean);
                const perPersonAmount = expense.amount / expense.participants.length;

                // Title cell (clickable to view details)
                const titleCell = document.createElement('td');
                const titleLink = document.createElement('a');
                titleLink.href = '#';
                titleLink.style.cursor = 'pointer';
                titleLink.style.color = 'var(--primary-color)';
                titleLink.style.textDecoration = 'none';
                titleLink.style.fontWeight = '500';
                titleLink.textContent = expense.title;
                titleLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showExpenseDetails(trip, expense);
                });
                titleCell.appendChild(titleLink);

                // Amount cell
                const amountCell = document.createElement('td');
                amountCell.textContent = `₹${expense.amount.toFixed(2)}`;
                amountCell.style.fontWeight = '600';
                amountCell.style.color = 'var(--primary-color)';

                // Paid By cell
                const paidByCell = document.createElement('td');
                paidByCell.textContent = paidByPerson?.name || 'Unknown';

                // Participants cell
                const participantsCell = document.createElement('td');
                participantsCell.textContent = participantNames.join(', ');

                // Per Person cell
                const perPersonCell = document.createElement('td');
                perPersonCell.textContent = `₹${perPersonAmount.toFixed(2)}`;

                // Actions cell
                const actionsCell = document.createElement('td');
                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.gap = '0.5rem';

                const viewBtn = document.createElement('button');
                viewBtn.className = 'btn btn-secondary';
                viewBtn.style.padding = '0.4rem 0.8rem';
                viewBtn.style.fontSize = '0.85rem';
                viewBtn.textContent = 'View';
                viewBtn.title = 'View details';
                viewBtn.addEventListener('click', () => {
                    showExpenseDetails(trip, expense);
                });

                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-secondary';
                editBtn.style.padding = '0.4rem 0.8rem';
                editBtn.style.fontSize = '0.85rem';
                editBtn.textContent = 'Edit';
                editBtn.title = 'Edit expense';
                editBtn.addEventListener('click', () => {
                    openEditExpenseModal(trip.id, expense);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger';
                deleteBtn.style.padding = '0.4rem 0.8rem';
                deleteBtn.style.fontSize = '0.85rem';
                deleteBtn.textContent = 'Delete';
                deleteBtn.title = 'Delete expense';
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Delete expense "${expense.title}"?`)) {
                        deleteExpense(trip.id, expense.id);
                    }
                });

                actions.appendChild(viewBtn);
                actions.appendChild(editBtn);
                actions.appendChild(deleteBtn);
                actionsCell.appendChild(actions);

                row.appendChild(titleCell);
                row.appendChild(amountCell);
                row.appendChild(paidByCell);
                row.appendChild(participantsCell);
                row.appendChild(perPersonCell);
                row.appendChild(actionsCell);
                
                expensesListConsolidated.appendChild(row);
            });
        }
    }
}

// ============================================
// PRINT FUNCTIONALITY
// ============================================

/**
 * Print settlement using browser print functionality
 */
function printSettlement(trip) {
    if (!trip) {
        alert('No trip selected');
        return;
    }

    const balances = calculateBalances(trip);
    const settlements = resolveSettlements(balances, trip.persons);

    if (settlements.length === 0) {
        alert('No settlements to print');
        return;
    }

    // Create a print-friendly window
    const printWindow = window.open('', '_blank');
    
    const personMap = {};
    trip.persons.forEach(person => {
        personMap[person.id] = person.name;
    });

    const dateStr = new Date().toLocaleDateString();
    
    // Build HTML content
    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Settlement Report - ${trip.name}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    color: #000;
                }
                .print-header {
                    margin-bottom: 30px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 15px;
                }
                .print-header h1 {
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                .print-header p {
                    font-size: 14px;
                    margin: 5px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 10px;
                    text-align: left;
                }
                th {
                    background-color: #333;
                    color: #fff;
                    font-weight: bold;
                }
                tbody tr:nth-child(even) {
                    background-color: #f5f5f5;
                }
                tbody tr:nth-child(odd) {
                    background-color: #ffffff;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-top: 30px;
                    margin-bottom: 10px;
                }
                @media print {
                    @page {
                        margin: 1cm;
                        size: A4;
                    }
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Settlement Report</h1>
                <p><strong>Trip:</strong> ${trip.name}</p>
                <p><strong>Date:</strong> ${dateStr}</p>
            </div>
            
            <div class="section-title">Who Pays Whom</div>
            <table>
                <thead>
                    <tr>
                        <th>Who Pays</th>
                        <th>To Whom</th>
                        <th>Amount (Rs)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    settlements.forEach(settlement => {
        const fromName = personMap[settlement.from] || 'Unknown';
        const toName = personMap[settlement.to] || 'Unknown';
        const amount = settlement.amount.toFixed(2);
        
        htmlContent += `
                    <tr>
                        <td>${fromName}</td>
                        <td>${toName}</td>
                        <td>${amount}</td>
                    </tr>
        `;
    });

    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

/**
 * Print consolidated view with Settlement, Summary, and Expenses
 */
function printConsolidatedView(trip) {
    if (!trip) {
        alert('No trip selected');
        return;
    }

    const balances = calculateBalances(trip);
    const settlements = resolveSettlements(balances, trip.persons);

    // Create a print-friendly window
    const printWindow = window.open('', '_blank');
    
    const personMap = {};
    trip.persons.forEach(person => {
        personMap[person.id] = person.name;
    });

    const dateStr = new Date().toLocaleDateString();
    
    // Calculate total amount spent
    const totalAmountSpent = trip.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate totals for summary
    let totalPaid = {};
    let totalShare = {};
    
    trip.persons.forEach(person => {
        totalPaid[person.id] = 0;
        totalShare[person.id] = 0;
    });

    trip.expenses.forEach(expense => {
        const split = expense.amount / expense.participants.length;
        totalPaid[expense.paidBy] += expense.amount;
        expense.participants.forEach(participantId => {
            totalShare[participantId] += split;
        });
    });

    // Round totals
    Object.keys(totalPaid).forEach(id => {
        totalPaid[id] = Math.round(totalPaid[id] * 100) / 100;
        totalShare[id] = Math.round(totalShare[id] * 100) / 100;
    });

    // Sort expenses by creation date (newest first)
    const sortedExpenses = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt);
    
    // Build HTML content
    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Consolidated Report - ${trip.name}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    color: #000;
                }
                .print-header {
                    margin-bottom: 30px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 15px;
                }
                .print-header h1 {
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                .print-header p {
                    font-size: 14px;
                    margin: 5px 0;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    color: #333;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 10px;
                    text-align: left;
                }
                th {
                    background-color: #333;
                    color: #fff;
                    font-weight: bold;
                }
                tbody tr:nth-child(even) {
                    background-color: #f5f5f5;
                }
                tbody tr:nth-child(odd) {
                    background-color: #ffffff;
                }
                .balance-positive {
                    color: #27ae60;
                    font-weight: bold;
                }
                .balance-negative {
                    color: #e74c3c;
                    font-weight: bold;
                }
                .balance-zero {
                    color: #7f8c8d;
                }
                @media print {
                    @page {
                        margin: 1cm;
                        size: A4;
                    }
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Consolidated Trip Report</h1>
                <p><strong>Trip:</strong> ${trip.name}</p>
                <p><strong>Date:</strong> ${dateStr}</p>
                ${trip.budget ? `<p><strong>Budget:</strong> ₹${trip.budget.toFixed(2)}</p>` : ''}
                <p><strong>Amount Spent:</strong> ₹${totalAmountSpent.toFixed(2)}</p>
            </div>
            
            <!-- Settlement Section -->
            <div class="section-title">1. Settlement - Who Pays Whom</div>
            <table>
                <thead>
                    <tr>
                        <th>Who Pays</th>
                        <th>To Whom</th>
                        <th>Amount (Rs)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (settlements.length === 0) {
        htmlContent += `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 20px;">All balances are settled!</td>
                    </tr>
        `;
    } else {
        settlements.forEach(settlement => {
            const fromName = personMap[settlement.from] || 'Unknown';
            const toName = personMap[settlement.to] || 'Unknown';
            const amount = settlement.amount.toFixed(2);
            
            htmlContent += `
                        <tr>
                            <td>${fromName}</td>
                            <td>${toName}</td>
                            <td>${amount}</td>
                        </tr>
            `;
        });
    }

    htmlContent += `
                </tbody>
            </table>

            <!-- Summary Section -->
            <div class="section-title">2. Expense Summary</div>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Paid</th>
                        <th>Share</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
    `;

    trip.persons.forEach(person => {
        const balance = balances[person.id] || 0;
        const balanceClass = balance > 0.01 ? 'balance-positive' : 
                           balance < -0.01 ? 'balance-negative' : 'balance-zero';
        
        htmlContent += `
                    <tr>
                        <td>${person.name}</td>
                        <td>${totalPaid[person.id].toFixed(2)}</td>
                        <td>${totalShare[person.id].toFixed(2)}</td>
                        <td class="${balanceClass}">${balance.toFixed(2)}</td>
                    </tr>
        `;
    });

    htmlContent += `
                </tbody>
            </table>

            <!-- Expenses Section -->
            <div class="section-title">3. Expenses</div>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Amount</th>
                        <th>Paid By</th>
                        <th>Participants</th>
                        <th>Per Person</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (sortedExpenses.length === 0) {
        htmlContent += `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 20px;">No expenses added yet</td>
                    </tr>
        `;
    } else {
        sortedExpenses.forEach(expense => {
            const paidByPerson = trip.persons.find(p => p.id === expense.paidBy);
            const participantNames = expense.participants
                .map(id => trip.persons.find(p => p.id === id)?.name)
                .filter(Boolean);
            const perPersonAmount = expense.amount / expense.participants.length;
            
            htmlContent += `
                        <tr>
                            <td>${expense.title}</td>
                            <td>${expense.amount.toFixed(2)}</td>
                            <td>${paidByPerson?.name || 'Unknown'}</td>
                            <td>${participantNames.join(', ')}</td>
                            <td>${perPersonAmount.toFixed(2)}</td>
                        </tr>
            `;
        });
    }

    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

// ============================================
// PDF EXPORT
// ============================================

/**
 * Export settlement as PDF
 */
function exportSettlementPDF(trip) {
    if (!trip) {
        alert('No trip selected');
        return;
    }

    const balances = calculateBalances(trip);
    const settlements = resolveSettlements(balances, trip.persons);

    if (settlements.length === 0) {
        alert('No settlements to export');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Settlement Report', 14, 20);
    
    // Trip name
    doc.setFontSize(14);
    const tripNameText = 'Trip: ' + trip.name;
    doc.text(tripNameText, 14, 30);
    
    // Date
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString();
    const dateText = 'Date: ' + dateStr;
    doc.text(dateText, 14, 37);
    
    // Settlement table
    let yPos = 50;
    doc.setFontSize(12);
    doc.text('Who Pays Whom', 14, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    const personMap = {};
    trip.persons.forEach(person => {
        personMap[person.id] = person.name;
    });

    settlements.forEach((settlement, index) => {
        if (yPos > 270) { // New page if needed
            doc.addPage();
            yPos = 20;
        }
        
        const fromName = personMap[settlement.from] || 'Unknown';
        const toName = personMap[settlement.to] || 'Unknown';
        const amount = settlement.amount.toFixed(2);
        
        // Build text as a single string to avoid character-by-character rendering
        // Format: "fromName's toName : Rs amount"
        // Build the string step by step to ensure it's a proper string primitive
        const settlementText = fromName + "'s " + toName + " : Rs " + amount;
        
        // Use text() method - jsPDF text() expects a string primitive
        // Pass the string directly, not as an array or object
        doc.text(settlementText, 14, yPos);
        yPos += 7;
    });

    // Save PDF
    const fileName = 'settlement_' + trip.name.replace(/\s+/g, '_') + '_' + Date.now() + '.pdf';
    doc.save(fileName);
}

// ============================================
// MODAL HANDLERS
// ============================================

/**
 * Show modal
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Hide modal
 */
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Setup modal close handlers
 */
function setupModals() {
    // Close buttons
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.getAttribute('data-modal');
            if (modalId) {
                hideModal(modalId);
            }
        });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Setup tab switching functionality
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(targetTab + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

/**
 * Setup all event handlers
 */
function setupEventHandlers() {
    // Create trip
    document.getElementById('createTripBtn').addEventListener('click', () => {
        showModal('createTripModal');
    });

    document.getElementById('createTripForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('tripNameInput').value;
        const budget = document.getElementById('tripBudgetInput').value;
        if (createTrip(name, budget)) {
            hideModal('createTripModal');
            document.getElementById('createTripForm').reset();
        }
    });

    // Add person
    document.getElementById('addPersonBtn').addEventListener('click', () => {
        if (!currentTripId) {
            alert('Please select a trip first');
            return;
        }
        showModal('addPersonModal');
    });

    document.getElementById('addPersonForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('personNameInput').value;
        if (addPersonToTrip(currentTripId, name)) {
            hideModal('addPersonModal');
            document.getElementById('addPersonForm').reset();
        }
    });

    // Add expense
    document.getElementById('addExpenseBtn').addEventListener('click', () => {
        if (!currentTripId) {
            alert('Please select a trip first');
            return;
        }
        
        const trip = getTrip(currentTripId);
        if (trip.persons.length < 2) {
            alert('You need at least 2 persons before adding expenses');
            return;
        }

        // Sort persons alphabetically by name (ascending order)
        const sortedPersons = [...trip.persons].sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

        // Populate paidBy select
        const paidBySelect = document.getElementById('expensePaidBySelect');
        paidBySelect.innerHTML = '<option value="">Select person</option>';
        sortedPersons.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            paidBySelect.appendChild(option);
        });

        // Populate participants checkboxes
        const participantsDiv = document.getElementById('participantsCheckboxes');
        participantsDiv.innerHTML = '';
        sortedPersons.forEach(person => {
            const label = document.createElement('label');
            label.className = 'participant-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = person.id;
            checkbox.id = `participant_${person.id}`;
            
            const span = document.createElement('span');
            span.textContent = person.name;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            participantsDiv.appendChild(label);
        });

        // Auto-select paidBy when changed
        paidBySelect.addEventListener('change', function() {
            const paidById = this.value;
            if (paidById) {
                const checkbox = document.getElementById(`participant_${paidById}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
        });

        // Select all participants button
        const selectAllBtn = document.getElementById('selectAllParticipantsBtn');
        if (selectAllBtn) {
            selectAllBtn.onclick = function() {
                const checkboxes = document.querySelectorAll('#participantsCheckboxes input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => {
                    cb.checked = !allChecked;
                });
                selectAllBtn.textContent = allChecked ? 'Select All Members' : 'Deselect All';
            };
        }

        showModal('addExpenseModal');
    });

    document.getElementById('addExpenseForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('expenseTitleInput').value;
        const amount = parseFloat(document.getElementById('expenseAmountInput').value);
        const paidBy = document.getElementById('expensePaidBySelect').value;
        
        const participants = Array.from(document.querySelectorAll('#participantsCheckboxes input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        if (addExpense(currentTripId, { title, amount, paidBy, participants })) {
            hideModal('addExpenseModal');
            document.getElementById('addExpenseForm').reset();
        }
    });

    // Select all trips
    document.getElementById('selectAllTrips').addEventListener('change', (e) => {
        const data = loadData();
        if (e.target.checked) {
            data.trips.forEach(trip => selectedTripIds.add(trip.id));
        } else {
            selectedTripIds.clear();
        }
        renderTripList();
    });

    // Delete selected trips
    document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
        if (selectedTripIds.size > 0) {
            bulkDeleteTrips(Array.from(selectedTripIds));
        }
    });

    // Print Settlement
    document.getElementById('printBtn').addEventListener('click', () => {
        if (!currentTripId) {
            alert('Please select a trip first');
            return;
        }
        const trip = getTrip(currentTripId);
        printSettlement(trip);
    });

    // Export PDF
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        if (!currentTripId) {
            alert('Please select a trip first');
            return;
        }
        const trip = getTrip(currentTripId);
        exportSettlementPDF(trip);
    });

    // Consolidated tab buttons
    const printBtnConsolidated = document.getElementById('printBtnConsolidated');
    if (printBtnConsolidated) {
        printBtnConsolidated.addEventListener('click', () => {
            if (!currentTripId) {
                alert('Please select a trip first');
                return;
            }
            const trip = getTrip(currentTripId);
            printConsolidatedView(trip);
        });
    }

    const exportPdfBtnConsolidated = document.getElementById('exportPdfBtnConsolidated');
    if (exportPdfBtnConsolidated) {
        exportPdfBtnConsolidated.addEventListener('click', () => {
            if (!currentTripId) {
                alert('Please select a trip first');
                return;
            }
            const trip = getTrip(currentTripId);
            exportSettlementPDF(trip);
        });
    }

    const addExpenseBtnConsolidated = document.getElementById('addExpenseBtnConsolidated');
    if (addExpenseBtnConsolidated) {
        addExpenseBtnConsolidated.addEventListener('click', () => {
            // Trigger the same add expense flow
            document.getElementById('addExpenseBtn').click();
        });
    }

    // Edit expense form handler
    const editExpenseForm = document.getElementById('editExpenseForm');
    if (editExpenseForm) {
        editExpenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const expenseId = document.getElementById('editExpenseId').value;
            const title = document.getElementById('editExpenseTitleInput').value;
            const amount = parseFloat(document.getElementById('editExpenseAmountInput').value);
            const paidBy = document.getElementById('editExpensePaidBySelect').value;
            
            const participants = Array.from(document.querySelectorAll('#editParticipantsCheckboxes input[type="checkbox"]:checked'))
                .map(cb => cb.value);

            if (updateExpense(currentTripId, expenseId, { title, amount, paidBy, participants })) {
                hideModal('editExpenseModal');
                document.getElementById('editExpenseForm').reset();
            }
        });
    }
}

/**
 * Show expense details in a modal
 */
function showExpenseDetails(trip, expense) {
    const paidByPerson = trip.persons.find(p => p.id === expense.paidBy);
    const participantNames = expense.participants
        .map(id => {
            const person = trip.persons.find(p => p.id === id);
            return person ? person.name : null;
        })
        .filter(Boolean);
    const perPersonAmount = expense.amount / expense.participants.length;
    const expenseDate = new Date(expense.createdAt).toLocaleString();

    const detailsContent = document.getElementById('expenseDetailsContent');
    detailsContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
                <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Title</label>
                <div style="font-size: 1.1rem; font-weight: 500;">${expense.title}</div>
            </div>
            <div>
                <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Amount</label>
                <div style="font-size: 1.2rem; font-weight: 600; color: var(--primary-color);">₹${expense.amount.toFixed(2)}</div>
            </div>
            <div>
                <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Paid By</label>
                <div style="font-size: 1rem;">${paidByPerson?.name || 'Unknown'}</div>
            </div>
            <div>
                <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Participants (${expense.participants.length})</label>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${participantNames.map(name => `<span style="padding: 0.4rem 0.8rem; background-color: #f0f0f0; border-radius: 4px; font-size: 0.9rem;">${name}</span>`).join('')}
                </div>
            </div>
            <div>
                <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Per Person Share</label>
                <div style="font-size: 1rem; font-weight: 500;">₹${perPersonAmount.toFixed(2)}</div>
            </div>
            <div>
                <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Date</label>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">${expenseDate}</div>
            </div>
        </div>
        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="hideModal('expenseDetailsModal')">Close</button>
            <button type="button" class="btn btn-primary" onclick="openEditExpenseModal('${trip.id}', ${JSON.stringify(expense).replace(/"/g, '&quot;')}); hideModal('expenseDetailsModal');">Edit Expense</button>
        </div>
    `;

    showModal('expenseDetailsModal');
}

/**
 * Open edit expense modal
 */
function openEditExpenseModal(tripId, expense) {
    if (!tripId || !expense) {
        return;
    }

    const trip = getTrip(tripId);
    if (!trip) {
        alert('Trip not found');
        return;
    }

    // Populate form fields
    document.getElementById('editExpenseId').value = expense.id;
    document.getElementById('editExpenseTitleInput').value = expense.title;
    document.getElementById('editExpenseAmountInput').value = expense.amount;

    // Sort persons alphabetically by name (ascending order)
    const sortedPersons = [...trip.persons].sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    // Populate paidBy select
    const paidBySelect = document.getElementById('editExpensePaidBySelect');
    paidBySelect.innerHTML = '<option value="">Select person</option>';
    sortedPersons.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        option.selected = person.id === expense.paidBy;
        paidBySelect.appendChild(option);
    });

    // Populate participants checkboxes
    const participantsDiv = document.getElementById('editParticipantsCheckboxes');
    participantsDiv.innerHTML = '';
    sortedPersons.forEach(person => {
        const label = document.createElement('label');
        label.className = 'participant-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = person.id;
        checkbox.id = `edit_participant_${person.id}`;
        checkbox.checked = expense.participants.includes(person.id);
        
        const span = document.createElement('span');
        span.textContent = person.name;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        participantsDiv.appendChild(label);
    });

    // Optional: Auto-select paidBy when changed (commented out to allow paid person to not be participant)
    // paidBySelect.addEventListener('change', function() {
    //     const paidById = this.value;
    //     if (paidById) {
    //         const checkbox = document.getElementById(`edit_participant_${paidById}`);
    //         if (checkbox) {
    //             checkbox.checked = true;
    //         }
    //     }
    // });

    // Select all participants button
    const selectAllBtn = document.getElementById('editSelectAllParticipantsBtn');
    if (selectAllBtn) {
        selectAllBtn.onclick = function() {
            const checkboxes = document.querySelectorAll('#editParticipantsCheckboxes input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => {
                cb.checked = !allChecked;
            });
            selectAllBtn.textContent = allChecked ? 'Select All Members' : 'Deselect All';
        };
    }

    showModal('editExpenseModal');
}


// ============================================
// SELF TEST
// ============================================

/**
 * Self-test function - tests the settlement logic
 * Test case:
 * Trip: Goa
 * Persons: A, B, C
 * Expense 1: 300 paid by A, participants A B C
 * Expense 2: 300 paid by B, participants B C
 * 
 * Expected balances:
 * A = +100
 * B = 0
 * C = -100
 * 
 * Expected settlement:
 * C → A : 100
 */
function runSelfTest() {
    console.log('========================================');
    console.log('SELF TEST: Settlement Logic');
    console.log('========================================');

    // Create test trip
    const testTripId = generateUUID();
    const testTrip = {
        id: testTripId,
        name: 'Goa',
        persons: [
            { id: 'person_a', name: 'A' },
            { id: 'person_b', name: 'B' },
            { id: 'person_c', name: 'C' }
        ],
        expenses: [
            {
                id: 'expense_1',
                title: 'Expense 1',
                amount: 300,
                paidBy: 'person_a',
                participants: ['person_a', 'person_b', 'person_c'],
                createdAt: Date.now()
            },
            {
                id: 'expense_2',
                title: 'Expense 2',
                amount: 300,
                paidBy: 'person_b',
                participants: ['person_b', 'person_c'],
                createdAt: Date.now() + 1
            }
        ]
    };

    console.log('Test Trip:', testTrip.name);
    console.log('Persons:', testTrip.persons.map(p => p.name).join(', '));
    console.log('Expenses:');
    testTrip.expenses.forEach((exp, idx) => {
        console.log(`  ${idx + 1}. ${exp.title}: ₹${exp.amount} paid by ${testTrip.persons.find(p => p.id === exp.paidBy)?.name}, participants: ${exp.participants.map(id => testTrip.persons.find(p => p.id === id)?.name).join(', ')}`);
    });

    // Calculate balances
    const balances = calculateBalances(testTrip);
    console.log('\nCalculated Balances:');
    Object.keys(balances).forEach(personId => {
        const person = testTrip.persons.find(p => p.id === personId);
        console.log(`  ${person?.name}: ₹${balances[personId].toFixed(2)}`);
    });

    // Verify expected balances
    const expectedBalances = {
        'person_a': 100,
        'person_b': 0,
        'person_c': -100
    };

    console.log('\nExpected Balances:');
    Object.keys(expectedBalances).forEach(personId => {
        const person = testTrip.persons.find(p => p.id === personId);
        console.log(`  ${person?.name}: ₹${expectedBalances[personId].toFixed(2)}`);
    });

    // Check if balances match
    let balancesMatch = true;
    Object.keys(expectedBalances).forEach(personId => {
        const actual = balances[personId];
        const expected = expectedBalances[personId];
        if (Math.abs(actual - expected) > 0.01) {
            balancesMatch = false;
            console.error(`  ❌ Mismatch for ${testTrip.persons.find(p => p.id === personId)?.name}: expected ₹${expected.toFixed(2)}, got ₹${actual.toFixed(2)}`);
        } else {
            console.log(`  ✓ ${testTrip.persons.find(p => p.id === personId)?.name} balance matches`);
        }
    });

    // Calculate settlement
    const settlements = resolveSettlements(balances, testTrip.persons);
    console.log('\nSettlement (Who Pays Whom):');
    if (settlements.length === 0) {
        console.log('  No settlements needed');
    } else {
        settlements.forEach(settlement => {
            const fromName = testTrip.persons.find(p => p.id === settlement.from)?.name;
            const toName = testTrip.persons.find(p => p.id === settlement.to)?.name;
            console.log(`  ${fromName} → ${toName} : ₹${settlement.amount.toFixed(2)}`);
        });
    }

    // Expected settlement
    console.log('\nExpected Settlement:');
    console.log('  C → A : ₹100.00');

    // Verify settlement
    if (settlements.length === 1) {
        const settlement = settlements[0];
        const fromName = testTrip.persons.find(p => p.id === settlement.from)?.name;
        const toName = testTrip.persons.find(p => p.id === settlement.to)?.name;
        if (fromName === 'C' && toName === 'A' && Math.abs(settlement.amount - 100) < 0.01) {
            console.log('  ✓ Settlement matches expected result');
        } else {
            console.error(`  ❌ Settlement mismatch: expected C → A : ₹100.00, got ${fromName} → ${toName} : ₹${settlement.amount.toFixed(2)}`);
        }
    } else {
        console.error(`  ❌ Expected 1 settlement, got ${settlements.length}`);
    }

    // Verify sum of balances equals 0
    const sum = Object.values(balances).reduce((a, b) => a + b, 0);
    console.log('\nBalance Sum Check:');
    console.log(`  Sum of all balances: ₹${sum.toFixed(2)}`);
    if (Math.abs(sum) < 0.01) {
        console.log('  ✓ Sum equals 0.00 (correct)');
    } else {
        console.error(`  ❌ Sum should be 0.00, got ₹${sum.toFixed(2)}`);
    }

    console.log('\n========================================');
    if (balancesMatch && Math.abs(sum) < 0.01 && settlements.length === 1) {
        console.log('✅ SELF TEST PASSED');
    } else {
        console.log('❌ SELF TEST FAILED');
    }
    console.log('========================================\n');
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
function init() {
    setupModals();
    setupTabs();
    setupEventHandlers();
    renderTripList();
    
    // Run self-test
    runSelfTest();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
