import { useEffect, useState, useRef, useMemo } from "react";
import { DataGrid } from '@mui/x-data-grid';
import { Container, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Box, ThemeProvider, createTheme, CssBaseline, Stack, Alert, Snackbar, Grid, IconButton } from "@mui/material";
import axios from 'axios';
import * as XLSX from 'xlsx';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InventoryIcon from '@mui/icons-material/Inventory';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Custom MUI theme configuration for a cleaner, modern look
const appleTheme = createTheme({
  palette: {
    primary: { main: '#0071e3' },
    background: { default: '#F5F5F7' },
    text: { primary: '#1D1D1F', secondary: '#86868b' },
    success: { main: '#34c759' },
    warning: { main: '#ff9f0a' },
    error: { main: '#ff3b30' },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 500, fontSize: '0.9rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    h4: { fontWeight: 700, letterSpacing: '-0.5px' },
    body2: { fontSize: '0.85rem', fontWeight: 500 }
  },
  shape: { borderRadius: 12 }, 
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '6px 16px', boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        contained: { boxShadow: 'none' }
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { 
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)', // Slightly stronger shadow for dialog pop
          border: '1px solid rgba(0,0,0,0.04)' 
        },
      },
    },
    // Theme tweaks for inputs: lighter borders, softer labels
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10, 
          backgroundColor: '#fff',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#B0B0B5', // Lighter hover border
          },
        },
        notchedOutline: {
          borderColor: '#D1D1D6', // Very light default border (Apple style)
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: '#86868b' }, // Softer label color
        shrink: { transform: 'translate(14px, -9px) scale(0.85)' } // Smaller floating label
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: { border: 'none', backgroundColor: '#FFFFFF', borderRadius: 12 },
        columnHeaders: { backgroundColor: '#F9F9F9', color: '#6e6e73', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
        cell: { borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem' },
        row: { '&:hover': { backgroundColor: '#F5F5F7' } }
      },
    },
  },
});

function App() {
  // Main state for inventory data
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', price: '', stock: '' });
  
  // UI states
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const fileInputRef = useRef(null);

  // Fetch all products from the backend API
  const fetchProducts = () => {
    axios.get('http://localhost:5001/api/products')
      .then((response) => setProducts(response.data))
      .catch((error) => console.error("Error fetching products:", error));
  };

  // Initial load
  useEffect(() => { fetchProducts(); }, []);

  // Memoized stats calculation for the dashboard widgets to avoid re-renders
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((acc, curr) => acc + (curr.price * curr.stock), 0);
    
    // Sort by stock level to get top 5 low stock items for the chart
    const chartData = [...products]
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5)
      .map(p => ({ name: p.name, stock: p.stock }));
      
    return { totalProducts, totalValue, chartData };
  }, [products]);

  // Handle Excel Export using SheetJS
  const handleExport = () => {
    const dataToExport = products.map(row => ({ 
      "Product Name": row.name, 
      "Category": row.category, 
      "Price": row.price, 
      "Stock": row.stock 
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "Nexus_Inventory_Data.xlsx");
    
    setSnackMsg("🎉 Report Downloaded Successfully!");
    setSnackOpen(true);
  };

  const handleImportClick = () => fileInputRef.current.click();

  // Handle Excel Import and Bulk Insert
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const wsname = workbook.SheetNames[0];
      const ws = workbook.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      let successCount = 0;
      // Iterate and post each item to the backend
      data.forEach(async (item) => {
        const payload = {
          name: item['Product Name'] || item['name'],
          category: item['Category'] || item['category'] || 'Uncategorized',
          price: item['Price'] || item['price'] || 0,
          stock: item['Stock'] || item['stock'] || 0
        };
        try { 
          await axios.post('http://localhost:5001/api/products', payload); 
          successCount++; 
          if (successCount > 0) fetchProducts(); 
        } catch (err) { 
          console.error(err); 
        }
      });
      setSnackMsg(`🚀 Added ${data.length} items!`);
      setSnackOpen(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Reset input
  };

  // Form Handlers
  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = () => {
    if(!formData.name || !formData.price) return alert("Please fill details");
    
    axios.post('http://localhost:5001/api/products', formData)
      .then(() => { 
        handleClose(); 
        fetchProducts(); 
        setFormData({ name: '', category: '', price: '', stock: '' }); 
      })
      .catch(() => alert("Failed to add product"));
  };

  const handleDelete = (id) => {
    if(window.confirm("Are you sure you want to delete this product?")) {
      axios.delete(`http://localhost:5001/api/products/${id}`).then(() => fetchProducts());
    }
  };

  // DataGrid Column Definitions
  const columns = [
    { field: 'name', headerName: 'Product Name', flex: 1.5, minWidth: 200 },
    { field: 'category', headerName: 'Category', flex: 1, minWidth: 120 },
    { field: 'price', headerName: 'Price', width: 100, type: 'number', renderCell: (p) => `$${p.value.toLocaleString()}` },
    { field: 'stock', headerName: 'Stock', width: 100, type: 'number',
      renderCell: (p) => (
        <Box sx={{ 
          color: p.value < 10 ? '#ff3b30' : '#1D1D1F', 
          fontWeight: '500',
          display: 'flex', alignItems: 'center', height: '100%'
        }}>
          {/* Visual indicator for low stock */}
          {p.value < 10 && <Box sx={{width: 6, height: 6, borderRadius: '50%', bgcolor: '#ff3b30', mr: 1}} />}
          {p.value}
        </Box>
      )
    },
    { field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (<Button color="error" size="small" sx={{minWidth: 'auto', px: 1}} onClick={() => handleDelete(p.row._id)}>Delete</Button>),
    },
  ];

  return (
    <ThemeProvider theme={appleTheme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ mt: 5, mb: 10 }}>
        
        {/* Header Section */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" sx={{ color: '#1D1D1F' }}>Nexus Dashboard</Typography>
            <Typography variant="body2" sx={{ color: '#86868b', mt: 0.5 }}>Overview & Analytics</Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload}/>
            <Button variant="outlined" startIcon={<FileUploadIcon sx={{fontSize: 20}}/>} onClick={handleImportClick} sx={{borderColor: '#e5e5e5', color: '#1d1d1f'}}>Import</Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon sx={{fontSize: 20}}/>} onClick={handleExport} sx={{borderColor: '#e5e5e5', color: '#1d1d1f'}}>Export</Button>
            <Button variant="contained" onClick={handleClickOpen} disableElevation>+ New Product</Button>
          </Stack>
        </Stack>

        {/* Dashboard Widgets */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL PRODUCTS</Typography>
                <Typography variant="h4" sx={{ mt: 0.5, color: '#1D1D1F' }}>{stats.totalProducts}</Typography>
              </Box>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'rgba(0,113,227,0.08)', color: '#0071e3', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <InventoryIcon />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL VALUE</Typography>
                <Typography variant="h4" sx={{ mt: 0.5, color: '#1D1D1F' }}>${stats.totalValue.toLocaleString()}</Typography>
              </Box>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'rgba(52,199,89,0.08)', color: '#34c759', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <AttachMoneyIcon />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2.5, height: '100%', minHeight: 140 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <WarningAmberIcon sx={{ fontSize: 18, color: '#ff9f0a' }} />
                <Typography variant="subtitle2" fontWeight={600}>Low Stock Alert</Typography>
              </Stack>
              <Box sx={{ height: 100, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={stats.chartData} layout="vertical" barSize={8} margin={{ left: -20, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fill: '#86868b'}} interval={0} axisLine={false} tickLine={false} />
                    <Bar dataKey="stock" radius={[4, 4, 4, 4]}>
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.stock < 10 ? '#ff3b30' : '#e5e5e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Main Data Table */}
        <Paper elevation={0} sx={{ height: 500, width: '100%', overflow: 'hidden' }}>
          <DataGrid
            rows={products} columns={columns} getRowId={(row) => row._id}
            pageSizeOptions={[10, 20]} initialState={{ pagination: { paginationModel: { pageSize: 10 }} }}
            checkboxSelection disableRowSelectionOnClick sx={{ border: 0 }} 
          />
        </Paper>

        
        <Dialog 
          open={open} 
          onClose={handleClose} 
          // 1. Fixed width instead of 'sm', no 'fullWidth' to avoid stretching
          PaperProps={{ sx: { borderRadius: 4, width: '440px', maxWidth: '95vw' } }}
        >
          <DialogTitle sx={{ pt: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={700}>New Product</Typography>
            <IconButton onClick={handleClose} size="small" sx={{color: '#86868b'}}><CloseIcon /></IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 2 }}>
            {/* 2. Use Stack for clean vertical spacing */}
            <Stack spacing={2.5}>
              <TextField label="Product Name" name="name" fullWidth variant="outlined" value={formData.name} onChange={handleChange} />
              <TextField label="Category" name="category" fullWidth variant="outlined" value={formData.category} onChange={handleChange} />
              
              {/* 3. Side-by-side layout for numbers, using flex:1 to fit perfectly */}
              <Stack direction="row" spacing={2}>
                <TextField label="Price ($)" name="price" type="number" variant="outlined" value={formData.price} onChange={handleChange} sx={{ flex: 1 }} />
                <TextField label="Stock" name="stock" type="number" variant="outlined" value={formData.stock} onChange={handleChange} sx={{ flex: 1 }} />
              </Stack>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={handleClose} sx={{ color: '#666', fontWeight: 600 }}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" disableElevation sx={{ px: 3, fontWeight: 600 }}>Save Product</Button>
          </DialogActions>
        </Dialog>

        {/* Notification Snackbar */}
        <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="success" sx={{ width: '100%', borderRadius: 2 }}>{snackMsg}</Alert>
        </Snackbar>

      </Container>
    </ThemeProvider>
  );
}

export default App;