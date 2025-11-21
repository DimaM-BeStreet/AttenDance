/**
 * Table Component
 * Sortable, searchable data table with actions
 */

/**
 * Create a data table
 */
export function createTable(containerId, options = {}) {
  const {
    columns = [],
    data = [],
    searchable = true,
    sortable = true,
    pagination = true,
    itemsPerPage = 10,
    actions = null,
    onRowClick = null,
    emptyMessage = 'אין נתונים להצגה',
    selectable = false,
    onSelectionChange = null
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Table container not found');
    return null;
  }

  // Create table wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  wrapper.id = `${containerId}-wrapper`;

  // Create search bar if searchable
  if (searchable) {
    const searchBar = document.createElement('div');
    searchBar.className = 'table-search';
    searchBar.innerHTML = `
      <input type="text" 
             class="search-input" 
             placeholder="חיפוש..." 
             id="${containerId}-search">
      <span class="search-icon">🔍</span>
    `;
    wrapper.appendChild(searchBar);
  }

  // Create table
  const table = document.createElement('table');
  table.className = 'data-table';
  table.id = containerId;

  // Create thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Add checkbox column if selectable
  if (selectable) {
    const checkboxTh = document.createElement('th');
    checkboxTh.innerHTML = `<input type="checkbox" id="${containerId}-select-all">`;
    checkboxTh.style.width = '40px';
    headerRow.appendChild(checkboxTh);
  }

  // Add column headers
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.dataset.field = col.field;
    
    if (sortable && col.sortable !== false) {
      th.classList.add('sortable');
      th.innerHTML = `
        ${col.label}
        <span class="sort-icon">⇅</span>
      `;
    }
    
    if (col.width) {
      th.style.width = col.width;
    }
    
    headerRow.appendChild(th);
  });

  // Add actions column if provided
  if (actions) {
    const actionTh = document.createElement('th');
    actionTh.textContent = 'פעולות';
    actionTh.style.width = actions.width || '120px';
    headerRow.appendChild(actionTh);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create tbody
  const tbody = document.createElement('tbody');
  tbody.id = `${containerId}-tbody`;
  table.appendChild(tbody);

  wrapper.appendChild(table);

  // Create pagination if enabled
  if (pagination) {
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'table-pagination';
    paginationDiv.id = `${containerId}-pagination`;
    wrapper.appendChild(paginationDiv);
  }

  container.innerHTML = '';
  container.appendChild(wrapper);

  // Create table instance
  const tableInstance = {
    data: [...data],
    filteredData: [...data],
    currentPage: 1,
    itemsPerPage,
    sortField: null,
    sortOrder: 'asc',
    selectedRows: new Set(),

    render: function() {
      renderTableData(this, containerId, columns, actions, onRowClick, selectable, emptyMessage);
      if (pagination) {
        renderPagination(this, containerId);
      }
    },

    setData: function(newData) {
      this.data = [...newData];
      this.filteredData = [...newData];
      this.currentPage = 1;
      this.selectedRows.clear();
      this.render();
    },

    sort: function(field) {
      if (this.sortField === field) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortField = field;
        this.sortOrder = 'asc';
      }

      this.filteredData.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = aVal > bVal ? 1 : -1;
        return this.sortOrder === 'asc' ? comparison : -comparison;
      });

      this.render();
    },

    search: function(term) {
      const searchTerm = term.toLowerCase();
      
      this.filteredData = this.data.filter(row => {
        return columns.some(col => {
          const value = row[col.field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm);
        });
      });

      this.currentPage = 1;
      this.render();
    },

    getSelectedRows: function() {
      return Array.from(this.selectedRows).map(index => this.filteredData[index]);
    },

    clearSelection: function() {
      this.selectedRows.clear();
      this.render();
    }
  };

  // Setup event listeners
  setupTableEvents(tableInstance, containerId, columns, sortable, searchable, selectable, onSelectionChange);

  // Initial render
  tableInstance.render();

  return tableInstance;
}

/**
 * Render table data
 */
function renderTableData(tableInstance, containerId, columns, actions, onRowClick, selectable, emptyMessage) {
  const tbody = document.getElementById(`${containerId}-tbody`);
  if (!tbody) return;

  tbody.innerHTML = '';

  const { filteredData, currentPage, itemsPerPage } = tableInstance;
  
  if (filteredData.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0);
    emptyCell.className = 'empty-message';
    emptyCell.textContent = emptyMessage;
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
    return;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageData = filteredData.slice(start, end);

  pageData.forEach((row, index) => {
    const tr = document.createElement('tr');
    const globalIndex = start + index;
    
    if (onRowClick) {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('input[type="checkbox"]')) {
          onRowClick(row);
        }
      });
    }

    // Add checkbox if selectable
    if (selectable) {
      const checkboxTd = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = tableInstance.selectedRows.has(globalIndex);
      checkbox.dataset.index = globalIndex;
      checkbox.className = 'row-checkbox';
      checkboxTd.appendChild(checkbox);
      tr.appendChild(checkboxTd);
    }

    // Add data cells
    columns.forEach(col => {
      const td = document.createElement('td');
      
      // Add data-label for mobile responsive layout
      if (col.label) {
        td.setAttribute('data-label', col.label);
      }
      
      if (col.render) {
        const rendered = col.render(row[col.field], row);
        if (typeof rendered === 'string') {
          td.innerHTML = rendered;
        } else if (rendered instanceof HTMLElement) {
          td.appendChild(rendered);
        }
      } else {
        td.textContent = row[col.field] ?? '';
      }
      
      tr.appendChild(td);
    });

    // Add actions cell
    if (actions) {
      const actionsTd = document.createElement('td');
      actionsTd.className = 'actions-cell';
      
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'actions-container';

      actions.buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn btn-sm ${btn.className || 'btn-secondary'}`;
        button.innerHTML = btn.icon ? `${btn.icon} ${btn.label}` : btn.label;
        button.title = btn.title || btn.label;
        
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.onClick) btn.onClick(row);
        });
        
        actionsContainer.appendChild(button);
      });

      actionsTd.appendChild(actionsContainer);
      tr.appendChild(actionsTd);
    }

    tbody.appendChild(tr);
  });
}

/**
 * Render pagination
 */
function renderPagination(tableInstance, containerId) {
  const paginationDiv = document.getElementById(`${containerId}-pagination`);
  if (!paginationDiv) return;

  const { filteredData, currentPage, itemsPerPage } = tableInstance;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }

  paginationDiv.innerHTML = `
    <button class="pagination-btn" id="${containerId}-prev" ${currentPage === 1 ? 'disabled' : ''}>
      ‹ הקודם
    </button>
    <span class="pagination-info">
      עמוד ${currentPage} מתוך ${totalPages}
    </span>
    <button class="pagination-btn" id="${containerId}-next" ${currentPage === totalPages ? 'disabled' : ''}>
      הבא ›
    </button>
  `;
}

/**
 * Setup table event listeners
 */
function setupTableEvents(tableInstance, containerId, columns, sortable, searchable, selectable, onSelectionChange) {
  // Search
  if (searchable) {
    const searchInput = document.getElementById(`${containerId}-search`);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        tableInstance.search(e.target.value);
      });
    }
  }

  // Sort
  if (sortable) {
    const headers = document.querySelectorAll(`#${containerId} th.sortable`);
    headers.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.field;
        tableInstance.sort(field);
        
        // Update sort icons
        headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(`sort-${tableInstance.sortOrder}`);
      });
    });
  }

  // Pagination
  document.addEventListener('click', (e) => {
    if (e.target.id === `${containerId}-prev`) {
      if (tableInstance.currentPage > 1) {
        tableInstance.currentPage--;
        tableInstance.render();
      }
    } else if (e.target.id === `${containerId}-next`) {
      const totalPages = Math.ceil(tableInstance.filteredData.length / tableInstance.itemsPerPage);
      if (tableInstance.currentPage < totalPages) {
        tableInstance.currentPage++;
        tableInstance.render();
      }
    }
  });

  // Selection
  if (selectable) {
    document.addEventListener('change', (e) => {
      if (e.target.id === `${containerId}-select-all`) {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          const index = parseInt(cb.dataset.index);
          if (e.target.checked) {
            tableInstance.selectedRows.add(index);
          } else {
            tableInstance.selectedRows.delete(index);
          }
        });
        if (onSelectionChange) {
          onSelectionChange(tableInstance.getSelectedRows());
        }
      } else if (e.target.classList.contains('row-checkbox')) {
        const index = parseInt(e.target.dataset.index);
        if (e.target.checked) {
          tableInstance.selectedRows.add(index);
        } else {
          tableInstance.selectedRows.delete(index);
        }
        if (onSelectionChange) {
          onSelectionChange(tableInstance.getSelectedRows());
        }
      }
    });
  }
}

/**
 * Export table data to CSV
 */
export function exportToCSV(tableInstance, filename = 'data.csv') {
  const { columns, filteredData } = tableInstance;
  
  // Create CSV content
  const headers = columns.map(col => col.label).join(',');
  const rows = filteredData.map(row => 
    columns.map(col => {
      const value = row[col.field] ?? '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');

  // Download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
