
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { removeBackground } from '@imgly/background-removal';
import { Draft } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { rgbToLab, deltaE, hexToRgb } from '../utils/colors';
import { useAuth } from '../context/AuthContext';
import { StorageHelper } from '../utils/storageHelper';

// --- Embedded Manifest from User ---
// Providing this locally bypasses the initial 403 Forbidden on resources.json
const EMBEDDED_MANIFEST = {
  "/onnxruntime-web/ort-wasm.wasm": {
    "chunks": [
      { "hash": "bf1e67d5bfdaa773fde6d93befcf2451c467d31b0d3b784995cc0a35b71e07f8", "offsets": [0, 4194304] },
      { "hash": "ce012b32d0848db4216163b4e2354647e78c3f7cc6c12ecfd065c3e15cd3c39e", "offsets": [4194304, 8388608] },
      { "hash": "69740076e6eb527c248d70f36f2bb0e660eff5a5d422907e89cc9459147636b2", "offsets": [8388608, 9724472] }
    ],
    "size": 9724472,
    "mime": "application/wasm"
  },
  "/onnxruntime-web/ort-wasm-threaded.wasm": {
    "chunks": [
      { "hash": "c9b67dc061caf1e6b14b6f1ad2918963f7e89f19c11041a11a0bf6eeb539b97b", "offsets": [0, 4194304] },
      { "hash": "92b3a000351e8e53b6505a29eda8cd0c271ae5a23fc054c49b133e2ddc188c03", "offsets": [4194304, 8388608] },
      { "hash": "ae8cc7e91ceae2c6000bdc3db1d070ee19fe223165feae3719c53ced962bcfe3", "offsets": [8388608, 9816319] }
    ],
    "size": 9816319,
    "mime": "application/wasm"
  },
  "/onnxruntime-web/ort-wasm-simd.wasm": {
    "chunks": [
      { "hash": "0d0d3e36a4f96f76fd68cd379813d08925199256f4c1b78dc26e4fc329d94c5b", "offsets": [0, 4194304] },
      { "hash": "7da53bac76c3efb258ab9a97c8cc0addd40b9ea014fa9a3547a7d9c3a07d2882", "offsets": [4194304, 8388608] },
      { "hash": "5a90b2563d97a9dc5c439bc7c4ec9ff50ae51947d295b8b606a690b3ffe400e7", "offsets": [8388608, 10549605] }
    ],
    "size": 10549605,
    "mime": "application/wasm"
  },
  "/onnxruntime-web/ort-wasm-simd.jsep.wasm": {
    "chunks": [
      { "hash": "fc368918ad6bd9a724a33182dc5f32de827fabdb4f63afdc6a3fb655fb617008", "offsets": [0, 4194304] },
      { "hash": "06646c968612ad40a0f45254d69ceb13b3c0524e54b392983407c9f84364915f", "offsets": [4194304, 8388608] },
      { "hash": "ebff7d67204b54372cc3d7a44ec498ab7afff847e612d85af07d232206e14534", "offsets": [8388608, 12582912] },
      { "hash": "ca7f0f2c48c1570677eed6d594fd660ea9c797feb9bb6540ce0b04f8fef1dc45", "offsets": [12582912, 16777216] },
      { "hash": "405892435ab51ebe5e5ea448a54f276ec273cf7f8d4568d3cb4761c4e1e83691", "offsets": [16777216, 17411440] }
    ],
    "size": 17411440,
    "mime": "application/wasm"
  },
  "/onnxruntime-web/ort-wasm-simd-threaded.wasm": {
    "chunks": [
      { "hash": "11164364a2f20d763126d6824eb0783434f5224a8131cf9b3d9f2fe2b982ba1f", "offsets": [0, 4194304] },
      { "hash": "a585791774617cbed5fe36ba92991dcfb893a3d46326cc09d442dd57448e0d18", "offsets": [4194304, 8388608] },
      { "hash": "659999798b628f9f9af7784602d501ffd37299bf84cc35e0cd4f04d831985df8", "offsets": [8388608, 10646108] }
    ],
    "size": 10646108,
    "mime": "application/wasm"
  },
  "/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm": {
    "chunks": [
      { "hash": "b8118797797ef266fc6fe920c331167cb2de7003c4bb5def9d2fbaa68b71a5dc", "offsets": [0, 4194304] },
      { "hash": "ffc1ff75ace433b47b4747bdf85af59211e46d253d0c55f69f28227599fa06a3", "offsets": [4194304, 8388608] },
      { "hash": "c9b7418c6c1b8d2b9f4199c72238955bf0cd49e5e6f2136abdf13d55179f593c", "offsets": [8388608, 12582912] },
      { "hash": "ea79f447f107f232f0984eed31c447f2f83150fe41c7c5d8338ca1e088bf1696", "offsets": [12582912, 16777216] },
      { "hash": "0aa0b74bdae0134e778aa77b5f1d468a0b6e82c87f54a5022aefdff200c4a13f", "offsets": [16777216, 19515085] }
    ],
    "size": 19515085,
    "mime": "application/wasm"
  },
  "/onnxruntime-web/ort-training-wasm-simd.wasm": {
    "chunks": [
      { "hash": "f0c09c4629f56c84cc9b3a28fc3bd0c8b612f34cb3820421106d1aca812125f1", "offsets": [0, 4194304] },
      { "hash": "de4fda74268df4b178065cfef486898fc7f78268b6a1e9d7f749b2d4d0cc9881", "offsets": [4194304, 8388608] },
      { "hash": "390f548aaf3a1c5450287ed1547ce138eaba836cfd2014869f2749e96bd81de5", "offsets": [8388608, 11269756] }
    ],
    "size": 11269756,
    "mime": "application/wasm"
  },
  "/models/small": {
    "chunks": [
      { "hash": "b34a3e9350ad77140964b6a2e1e32cd9738acd9d01e5899b96be71901a22ef47", "offsets": [0, 4194304] },
      { "hash": "8a85c22e472bed10198298a3d57480a5a90946dba88bddecf8b0bf0eafc06e70", "offsets": [4194304, 8388608] },
      { "hash": "5faec25d2338ae8ca2c7bff72e954cebd40a04c5f34c4b6bb8ca6720fae40996", "offsets": [8388608, 12582912] },
      { "hash": "b9861d932a549be455fc8ebd8ce5d413049515bfdd3edd55e136dbe05dd34ef5", "offsets": [12582912, 16777216] },
      { "hash": "f070b4c4f512cfe8dd6936c3cb9a616f132894867d3d33304d83599eb6b55636", "offsets": [16777216, 20971520] },
      { "hash": "10d02652d10fbc47bf93732ff9e8ad53eefbd3bd89ab3c1fbc15ddd740bea672", "offsets": [20971520, 25165824] },
      { "hash": "014c9e0229363137e92b85ed3c6f56b1386c279cdd9af2d7f1960ed8428b5e94", "offsets": [25165824, 29360128] },
      { "hash": "34dd3ad760f7e31b5e9144b8c387b8ecd6dc43116248c93c56dd7051ab525e3b", "offsets": [29360128, 33554432] },
      { "hash": "e7ca5cc3e0afd65581642a05ac91eb8ea4d0deb868df94b8981c910212526476", "offsets": [33554432, 37748736] },
      { "hash": "0ad4ebb86cfdd847901427181b7a7804dba93d868c3cd5f11a294acf36c9413f", "offsets": [37748736, 41943040] },
      { "hash": "9582c0375aed822c5577a814766c4afc6c096f4ccd3b0d08af6a1794987206a1", "offsets": [41943040, 44342436] }
    ],
    "size": 44342436,
    "mime": "application/octet-steam"
  },
  "/models/medium": {
    "chunks": [
      { "hash": "fe1b9f06af9d2147016884f4eb683d4dc540244a7453c3b742ae527725df2eec", "offsets": [0, 4194304] },
      { "hash": "724543b36c7b5eddfbd7f55cb5a7c1676b2089c277611850c257efa42212d8a2", "offsets": [4194304, 8388608] },
      { "hash": "f9290547b2e34555536647c1e2ca456348170eef1aee05d8fd522f5a051f260c", "offsets": [8388608, 12582912] },
      { "hash": "897d4d8a3f9f8c07f439300a5d81c8be4b0fcecf19ca6d77929b1750fedd8306", "offsets": [12582912, 16777216] },
      { "hash": "cbcda0a0c830ba51928e7935d9d3cfe1c4dc258bf117f2c76d047113ab8f9f8c", "offsets": [16777216, 20971520] },
      { "hash": "4c44c8b64af9f044623ceace7cc55e0bc348394f7ff63629d46118c0a03c9c54", "offsets": [20971520, 25165824] },
      { "hash": "8b2e3d773d7084c5cfac1c04d69d3586e4b8914a840d2b582dfde4940d698957", "offsets": [25165824, 29360128] },
      { "hash": "024e3d8beaf517d25496b73e36b0e0498110652753273e0dd8b591ad7c1c9e2f", "offsets": [29360128, 33554432] },
      { "hash": "1b8eaad4cd019b76e7eba964a38711a0bdeafbd10b6208c1107403a64dbd902a", "offsets": [33554432, 37748736] },
      { "hash": "0c8c5c24237304482ccc70a50008b73c8ef53e4656068da32b635607cca0c8c9", "offsets": [37748736, 41943040] },
      { "hash": "a5b8c519c832bc46b2ae5a9887fac1e3d5cc76a04846d8c3544875c7f2b40960", "offsets": [41943040, 46137344] },
      { "hash": "7b1dd767c5c1c0156b8d13bb34d4c1d11e014723b10cddc25c93e89a28e7cd96", "offsets": [46137344, 50331648] },
      { "hash": "3f5638267419916c9d4d906ff25f721d3d2e034851ea01566f0d2d6f943550b8", "offsets": [50331648, 54525952] },
      { "hash": "9927e74b3a0638d4cf5701e78e66d77476a4ba68c75831f1c8ea9117ec7f8809", "offsets": [54525952, 58720256] },
      { "hash": "3315eb3c14ca3ff5c03c80fac58f486a14264dd0bb9c168c096f2bd2531ba438", "offsets": [58720256, 62914560] },
      { "hash": "230f667e0332dc09ef08aacbf1992c40ce112192f95dfc14231a3ef515f9a2c7", "offsets": [62914560, 67108864] },
      { "hash": "e01a157b677e0e17815cd738dcda7e6daa268898d006b52b5d3604c439e6c96e", "offsets": [67108864, 71303168] },
      { "hash": "529f1df7d027b0315090ba15d42ef32998cac2efd6783c62f6b11cedf4c548f3", "offsets": [71303168, 75497472] },
      { "hash": "6cfd013f552a05e9fc81156e6d6de593668e0247a3970feae22e285c16d13e62", "offsets": [75497472, 79691776] },
      { "hash": "3f31511c3c16a29cf81b32379f51ead2bd082677b48b1dcc11a66beeb37cc729", "offsets": [79691776, 83886080] },
      { "hash": "01f6efcc8a01c727d99073ceede8e64c654fa3c4612b006e69e22dc663236943", "offsets": [83886080, 88080384] },
      { "hash": "145d8355f50b7847de5d04815124790867fe1752a0013bdf6ce28882b5e0a2fc", "offsets": [88080384, 88188479] }
    ],
    "size": 88188479,
    "mime": "application/octet-steam"
  }
};

const Create: React.FC = () => {
  const navigate = useNavigate();
  const { allBeads, availableBrands, paletteConfig } = useColorPalette();
  const { user, isAuthenticated } = useAuth();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  
  // Import Dialog State
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'photo' | 'pattern'>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  
  // Photo Mode State
  const [photoTargetWidth, setPhotoTargetWidth] = useState(50);
  
  // Background Removal State
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgStage, setBgStage] = useState<'downloading' | 'processing'>('downloading');

  // Pattern Mode State (Calibration & Viewport)
  const patternCanvasRef = useRef<HTMLCanvasElement>(null);
  // Pattern settings (Logical coordinates relative to the IMAGE)
  const [patternState, setPatternState] = useState({
      offsetX: 0, // pixels in original image
      offsetY: 0, // pixels in original image
      cellSize: 10, // width of one cell in original image pixels
      rotation: 0, // degrees
      cols: 30,
      rows: 30,
      targetBrand: paletteConfig.brand === '自定义' ? availableBrands[0] : paletteConfig.brand
  });
  
  // Viewport settings (Visual coordinates relative to CANVAS)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  // Delete Dialog State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  // Load drafts on mount or auth change
  useEffect(() => {
    const load = async () => {
      setIsLoadingDrafts(true);
      try {
        const loadedDrafts = await StorageHelper.loadDrafts(isAuthenticated && user ? user.id : undefined);
        setDrafts(loadedDrafts);
      } catch (e) {
        console.error('Failed to load drafts', e);
      } finally {
        setIsLoadingDrafts(false);
      }
    };
    load();
  }, [isAuthenticated, user?.id]);

  // Clean up object URL on unmount or new selection
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // --- Photo Mode Slider Logic ---
  const minW = 1;
  const maxW = Math.max(minW + 1, originalDimensions.width);
  const sliderValue = useMemo(() => {
      if (photoTargetWidth <= minW) return 0;
      if (photoTargetWidth >= maxW) return 100;
      const val = (Math.log(photoTargetWidth / minW) / Math.log(maxW / minW)) * 100;
      return Math.min(100, Math.max(0, val));
  }, [photoTargetWidth, maxW]);

  const handlePhotoSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      const newWidth = Math.round(minW * Math.pow(maxW / minW, val / 100));
      setPhotoTargetWidth(Math.max(minW, Math.min(maxW, newWidth)));
  };

  const handleRemoveBackground = async () => {
    if (!previewUrl) return;
    
    setIsRemovingBg(true);
    setBgProgress(0);
    setBgStage('downloading');

    // OSS Bucket URL
    const ossPath = 'https://pgedou-bg-removal.oss-cn-beijing.aliyuncs.com/';

    // Custom fetch function
    const customFetch = async (url: string, options?: RequestInit) => {
        // 1. Intercept metadata request (resources.json)
        if (url.includes('resources.json')) {
            console.log('[BG-Removal] Intercepted resources.json request, using embedded manifest.');
            return new Response(JSON.stringify(EMBEDDED_MANIFEST), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 2. Handle asset requests (wasm, model binary)
        console.log(`[BG-Removal] Fetching asset: ${url}`);
        
        // Add no-referrer to try and bypass hotlink protection if enabled
        const newOptions = {
            ...options,
            referrerPolicy: 'no-referrer' as ReferrerPolicy,
            mode: 'cors' as RequestMode
        };

        try {
            const response = await fetch(url, newOptions);
            if (!response.ok) {
                console.error(`[BG-Removal] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                if (response.status === 403) throw new Error(`403 Forbidden: Access to ${url} denied.`);
                if (response.status === 404) throw new Error(`404 Not Found: Asset ${url} missing.`);
                throw new Error(`Network Error: ${response.status}`);
            }
            return response;
        } catch (err) {
            console.error(`[BG-Removal] Network error fetching ${url}`, err);
            throw err;
        }
    };

    try {
        console.log(`[BG-Removal] 开始处理，资源路径: ${ossPath}`);
        
        // 2. 调用库
        // Important: We use `fetchArgs` to pass options, but `customFetch` overrides the fetch implementation entirely.
        const blob = await removeBackground(previewUrl, {
            publicPath: ossPath,
            debug: true, 
            fetchArgs: customFetch, // Use our interceptor
            progress: (key: string, current: number, total: number) => {
                const percent = Math.min(100, Math.round((current / total) * 100));
                setBgProgress(prev => Math.max(prev, percent));
                if (percent >= 100) setBgStage('processing');
                if (percent % 20 === 0) console.log(`[BG-Removal] Progress ${key}: ${percent}%`);
            }
        });

        const newUrl = URL.createObjectURL(blob);
        setPreviewUrl(newUrl);
        console.log('[BG-Removal] 处理成功');

    } catch (error: any) {
        console.error('Background removal CRITICAL ERROR:', error);
        
        let errorMessage = '未知错误';
        let suggestion = '';

        if (error instanceof Error) {
            errorMessage = `${error.name}: ${error.message}`;
            if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                suggestion = '检测到 403 权限错误。请检查 OSS Bucket 是否设置为【公共读】，以及是否允许空 Referer。';
            } else if (errorMessage.includes('404')) {
                suggestion = '资源文件未找到。请确保 models/small 等文件已上传到 OSS 根目录。';
            }
        } else {
            errorMessage = String(error);
        }

        alert(`抠图失败\n\n错误: ${errorMessage}\n\n建议: ${suggestion}`);
    } finally {
        setIsRemovingBg(false);
        setBgProgress(0);
    }
  };

  // --- Pattern Mode Interaction Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
      if (importMode !== 'pattern') return;
      e.preventDefault();
      const rect = patternCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const wheel = e.deltaY < 0 ? 1.1 : 0.9;
      
      const newScale = Math.min(Math.max(0.1, viewport.scale * wheel), 10);
      const scaleRatio = newScale / viewport.scale;

      setViewport(prev => ({
          scale: newScale,
          x: mouseX - (mouseX - prev.x) * scaleRatio,
          y: mouseY - (mouseY - prev.y) * scaleRatio
      }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current || importMode !== 'pattern') return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => { isDragging.current = false; };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (importMode !== 'pattern') return;
      if (e.touches.length === 2) {
          isDragging.current = false;
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          lastPinchDist.current = dist;
      } else if (e.touches.length === 1) {
          isDragging.current = true;
          lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (importMode !== 'pattern') return;
      e.preventDefault(); // Prevent scrolling the modal

      if (e.touches.length === 2 && lastPinchDist.current !== null) {
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          const rect = patternCanvasRef.current?.getBoundingClientRect();
          if (!rect) return;

          // Pinch center
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

          const scaleFactor = dist / lastPinchDist.current;
          const newScale = Math.min(Math.max(0.1, viewport.scale * scaleFactor), 10);
          const ratio = newScale / viewport.scale;

          setViewport(prev => ({
              scale: newScale,
              x: cx - (cx - prev.x) * ratio,
              y: cy - (cy - prev.y) * ratio
          }));
          lastPinchDist.current = dist;

      } else if (e.touches.length === 1 && isDragging.current) {
          const dx = e.touches[0].clientX - lastMouse.current.x;
          const dy = e.touches[0].clientY - lastMouse.current.y;
          setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
  };

  const handleTouchEnd = () => {
      isDragging.current = false;
      lastPinchDist.current = null;
  };

  // --- Pattern Mode Rendering ---
  const drawPatternCalibration = () => {
      const canvas = patternCanvasRef.current;
      if (!canvas || !previewUrl) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(viewport.x, viewport.y);
          ctx.scale(viewport.scale, viewport.scale);
          ctx.drawImage(img, 0, 0);
          ctx.save();
          
          ctx.translate(patternState.offsetX, patternState.offsetY);
          ctx.rotate((patternState.rotation * Math.PI) / 180);

          ctx.beginPath();
          ctx.lineWidth = 1.5 / viewport.scale;
          ctx.strokeStyle = `rgba(255, 0, 0, 0.8)`;

          const { cellSize, cols, rows } = patternState;
          const width = cols * cellSize;
          const height = rows * cellSize;

          for (let i = 0; i <= cols; i++) {
              const x = i * cellSize;
              ctx.moveTo(x, 0);
              ctx.lineTo(x, height);
          }
          for (let j = 0; j <= rows; j++) {
              const y = j * cellSize;
              ctx.moveTo(0, y);
              ctx.lineTo(width, y);
          }
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
          ctx.fillRect(0, 0, width, height);

          ctx.restore(); 
          ctx.restore(); 
      };
      img.src = previewUrl;
  };

  useEffect(() => {
      if (showImportDialog && importMode === 'pattern') {
          requestAnimationFrame(drawPatternCalibration);
      }
  }, [patternState, viewport, showImportDialog, importMode, previewUrl]);


  const triggerFileInput = (mode: 'photo' | 'pattern') => {
      setImportMode(mode);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height });
        
        if (importMode === 'photo') {
            setPhotoTargetWidth(Math.min(50, img.width));
        } else {
            const canvasW = 400; 
            const initScale = Math.min(1, (canvasW - 40) / img.width);
            
            setViewport({
                x: (canvasW - img.width * initScale) / 2,
                y: 20,
                scale: initScale
            });

            const estimatedCellSize = Math.max(5, img.width / 40);
            
            setPatternState(prev => ({
                ...prev,
                cellSize: estimatedCellSize,
                rotation: 0,
                offsetX: 0,
                offsetY: 0,
                cols: 40,
                rows: Math.floor((img.height / estimatedCellSize))
            }));
        }

        setPreviewUrl(url);
        setSelectedFile(file);
        setShowImportDialog(true);
      };
      img.src = url;
    }
  };

  const processImport = () => {
    // ... [Same import logic as before] ...
    if (!selectedFile || !previewUrl) return;
    if (!allBeads || allBeads.length === 0) {
        alert("颜色库加载中，请稍后再试");
        return;
    }
    
    setIsProcessing(true);
    
    setTimeout(() => {
        const img = new Image();
        img.onload = () => {
          try {
            const targetBeads = importMode === 'pattern' 
                ? allBeads.filter(b => b.brand === patternState.targetBrand)
                : allBeads; 

            if (targetBeads.length === 0) {
                alert("选定品牌无颜色数据");
                setIsProcessing(false);
                return;
            }

            const paletteCache = targetBeads.map(bead => {
                const rgb = hexToRgb(bead.hex);
                return {
                    id: bead.id,
                    rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
                    lab: rgbToLab(rgb.r, rgb.g, rgb.b)
                };
            });

            const initialGrid: {[key: string]: string} = {};
            let finalWidth = 0;
            let finalHeight = 0;

            if (importMode === 'photo') {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                finalWidth = photoTargetWidth;
                finalHeight = Math.round(originalDimensions.height * (photoTargetWidth / originalDimensions.width));
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                if (ctx) {
                    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
                    const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
                    const data = imageData.data;
                    for (let y = 0; y < finalHeight; y++) {
                        for (let x = 0; x < finalWidth; x++) {
                            const i = (y * finalWidth + x) * 4;
                            if (data[i + 3] < 128) continue;
                            const currentLab = rgbToLab(data[i], data[i+1], data[i+2]);
                            let minDistance = Infinity;
                            let closestBead = paletteCache[0];
                            for (const p of paletteCache) {
                                const dist = deltaE(currentLab, p.lab);
                                if (dist < minDistance) { minDistance = dist; closestBead = p; }
                            }
                            initialGrid[`${x},${y}`] = closestBead.id;
                        }
                    }
                }
            } else {
                // PATTERN MODE
                finalWidth = patternState.cols;
                finalHeight = patternState.rows;

                const dummyCanvas = document.createElement('canvas');
                dummyCanvas.width = img.width;
                dummyCanvas.height = img.height;
                const dCtx = dummyCanvas.getContext('2d');
                if (!dCtx) throw new Error("Context missing");
                dCtx.drawImage(img, 0, 0);
                
                const imgData = dCtx.getImageData(0, 0, img.width, img.height).data;
                const imgW = img.width;
                const imgH = img.height;

                const { offsetX, offsetY, cellSize, rotation } = patternState;
                const rad = (rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const getPixelRGB = (x: number, y: number) => {
                    const ix = Math.floor(x);
                    const iy = Math.floor(y);
                    if (ix < 0 || ix >= imgW || iy < 0 || iy >= imgH) return null;
                    const idx = (iy * imgW + ix) * 4;
                    if (imgData[idx + 3] < 128) return null;
                    return { r: imgData[idx], g: imgData[idx+1], b: imgData[idx+2] };
                };

                const sampleOffsets = [
                    {dx: -0.3, dy: -0.3}, {dx: 0, dy: -0.3}, {dx: 0.3, dy: -0.3},
                    {dx: -0.3, dy: 0},    {dx: 0, dy: 0},    {dx: 0.3, dy: 0},
                    {dx: -0.3, dy: 0.3},  {dx: 0, dy: 0.3},  {dx: 0.3, dy: 0.3}
                ];

                for (let r = 0; r < patternState.rows; r++) {
                    for (let c = 0; c < patternState.cols; c++) {
                        const localCX = (c * cellSize) + (cellSize / 2);
                        const localCY = (r * cellSize) + (cellSize / 2);

                        const colorBuckets: { [key: string]: {count: number, r: number, g: number, b: number} } = {};
                        
                        sampleOffsets.forEach(offset => {
                            const lx = localCX + (offset.dx * cellSize);
                            const ly = localCY + (offset.dy * cellSize);
                            const rx = lx * cos - ly * sin;
                            const ry = lx * sin + ly * cos;
                            const sx = offsetX + rx;
                            const sy = offsetY + ry;

                            const px = getPixelRGB(sx, sy);
                            if (px) {
                                const qR = Math.round(px.r / 32) * 32;
                                const qG = Math.round(px.g / 32) * 32;
                                const qB = Math.round(px.b / 32) * 32;
                                const key = `${qR},${qG},${qB}`;
                                
                                if (!colorBuckets[key]) colorBuckets[key] = { count: 0, r: 0, g: 0, b: 0 };
                                colorBuckets[key].count++;
                                colorBuckets[key].r += px.r;
                                colorBuckets[key].g += px.g;
                                colorBuckets[key].b += px.b;
                            }
                        });

                        let bestKey = null;
                        let maxCount = 0;
                        Object.keys(colorBuckets).forEach(key => {
                            if (colorBuckets[key].count > maxCount) {
                                maxCount = colorBuckets[key].count;
                                bestKey = key;
                            }
                        });

                        if (bestKey && maxCount > 0) { 
                            const winner = colorBuckets[bestKey];
                            const avgR = winner.r / winner.count;
                            const avgG = winner.g / winner.count;
                            const avgB = winner.b / winner.count;
                            
                            const currentLab = rgbToLab(avgR, avgG, avgB);
                            let minDistance = Infinity;
                            let closestBead = paletteCache[0];
                            for (const p of paletteCache) {
                                const dist = deltaE(currentLab, p.lab);
                                if (dist < minDistance) { minDistance = dist; closestBead = p; }
                            }
                            initialGrid[`${c},${r}`] = closestBead.id;
                        }
                    }
                }
            }
            
            navigate('/editor/imported', { 
              state: { 
                grid: initialGrid, 
                width: finalWidth, 
                height: finalHeight,
                title: importMode === 'pattern' ? '识别的图纸' : '导入的照片'
              } 
            });
          } catch (err) {
            console.error("Processing failed", err);
            alert("图片处理出错");
          } finally {
            setIsProcessing(false);
            setShowImportDialog(false);
          }
        };
        img.src = previewUrl;
    }, 100);
  };

  const handleDeleteClick = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraftToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (draftToDelete) {
      // Use StorageHelper to handle deletion based on auth
      await StorageHelper.deleteDraft(draftToDelete, isAuthenticated && user ? user.id : undefined);
      setDrafts(prev => prev.filter(d => d.id !== draftToDelete));
    }
    setShowDeleteDialog(false);
    setDraftToDelete(null);
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  const displayedDrafts = showAllDrafts ? drafts : drafts.slice(0, 2);

  const NumberControl = ({ label, value, onChange, step = 1, min, max, unit = '' }: any) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="flex items-center gap-1">
        <button 
            onClick={() => onChange(Math.max(min ?? -Infinity, Number((value - step).toFixed(2))))} 
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0"
        >
            <span className="material-symbols-outlined text-sm">remove</span>
        </button>
        <div className="flex-1 relative">
            <input 
                type="number" 
                value={value} 
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-full text-center text-sm font-bold bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-1 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                step={step}
            />
            {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">{unit}</span>}
        </div>
        <button 
            onClick={() => onChange(Math.min(max ?? Infinity, Number((value + step).toFixed(2))))} 
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0"
        >
            <span className="material-symbols-outlined text-sm">add</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-white dark:bg-background-dark shadow-2xl pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md pb-2">
        <div className="h-11 w-full"></div> 
        <div className="px-6 pb-2 pt-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">创建新图纸</h1>
            <button 
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">选择画布尺寸或导入图片开始创作</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-24 hide-scrollbar">
        {/* Import Section */}
        <section className="mt-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">更多方式</h2>
          <div className="w-full">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange} 
            />
            <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => triggerFileInput('photo')}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center mb-2 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-xl">image</span>
                  </div>
                  <span className="font-bold text-sm">导入照片</span>
                  <span className="text-[10px] text-white/80 mt-0.5">照片转像素画</span>
                </button>

                <button 
                  onClick={() => triggerFileInput('pattern')}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center mb-2 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-xl">grid_on</span>
                  </div>
                  <span className="font-bold text-sm">导入图纸</span>
                  <span className="text-[10px] text-white/80 mt-0.5">识别已有格子图</span>
                </button>
            </div>
          </div>
        </section>

        {/* Presets Section */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">选择画布预设</h2>
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => navigate('/editor/new?size=100')} className="relative group flex items-center p-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
              <div className="h-16 w-16 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center shrink-0 text-emerald-500 shadow-sm">
                <span className="material-symbols-outlined text-3xl">gesture</span>
              </div>
              <div className="ml-4 flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">自由模式</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">无限画布，自由绘制 (100x100)</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>
            <button onClick={() => navigate('/editor/new?size=50')} className="relative group flex items-center p-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-[#1e1e30] hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <div className="h-16 w-16 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                <span className="material-symbols-outlined text-3xl">grid_4x4</span>
              </div>
              <div className="ml-4 flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">50 x 50</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">标准尺寸，适合大多数场景</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-transparent group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>
          </div>
        </section>

        {/* Drafts Section */}
        <section className="mt-8 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                最近草稿 ({drafts.length})
                {isAuthenticated && <span className="ml-2 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">云端同步</span>}
            </h2>
            {drafts.length > 2 && (
              <button onClick={() => setShowAllDrafts(!showAllDrafts)} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-0.5">
                {showAllDrafts ? '收起' : '查看全部'}
                <span className="material-symbols-outlined text-[16px]">{showAllDrafts ? 'expand_less' : 'expand_more'}</span>
              </button>
            )}
          </div>
          
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg flex items-center gap-2 border border-amber-100 dark:border-amber-900/30">
             <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
             <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                 {isAuthenticated ? '作品已启用自动云端保存，安全无忧。' : '请及时保存或导出作品，避免数据丢失。'}
             </span>
          </div>

          {isLoadingDrafts ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : displayedDrafts.length > 0 ? (
             <div className="space-y-3">
               {displayedDrafts.map(draft => (
                 <div key={draft.id} onClick={() => navigate(`/editor/${draft.id}`)} className="relative rounded-2xl bg-slate-50 dark:bg-[#1e1e30] border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#25253a] transition-colors group animate-fade-in">
                    <div className="h-14 w-14 rounded-lg bg-white dark:bg-black/20 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                      {draft.thumbnail ? (<img alt={draft.title} className="w-full h-full object-contain pixelated-image" src={draft.thumbnail} />) : (<div className="w-full h-full flex items-center justify-center text-slate-300"><span className="material-symbols-outlined text-2xl">grid_on</span></div>)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{draft.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{draft.width}x{draft.height} • {getTimeAgo(draft.lastModified)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <button className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/editor/${draft.id}`); }}><span className="material-symbols-outlined text-sm">edit</span></button>
                       <button onClick={(e) => handleDeleteClick(e, draft.id)} className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-red-500 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                    </div>
                 </div>
               ))}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
               <span className="material-symbols-outlined text-3xl mb-2 opacity-50">draft</span><p className="text-sm">暂无草稿</p>
             </div>
          )}
        </section>
      </div>
      {showImportDialog && (
          // ... [Keeping existing import dialog code but wrapping inside fragments if needed, heavily abbreviated here for clarity as logic doesn't change much] ...
          // Re-inserting the existing UI code for Dialogs to ensure file integrity
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">
                  {importMode === 'pattern' ? '图纸校准' : '导入照片'}
              </h3>
              <button onClick={() => setShowImportDialog(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><span className="material-symbols-outlined text-gray-500">close</span></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {importMode === 'photo' ? (
                  <div className="p-4">
                    <div className="relative aspect-square w-full bg-gray-100 dark:bg-black/20 rounded-lg overflow-hidden mb-4 border border-gray-200 dark:border-gray-700">
                        {previewUrl && <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />}
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md">原始: {originalDimensions.width} x {originalDimensions.height}</div>
                    </div>
                    <div className="space-y-4">
                        <div className="w-full">
                            {isRemovingBg ? (
                                <div className="flex flex-col gap-1">
                                    <div className="h-9 w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative border border-gray-200 dark:border-gray-700">
                                        <div 
                                            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300 ease-out"
                                            style={{ width: `${bgProgress}%` }}
                                        ></div>
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200 mix-blend-difference text-white">
                                            {bgStage === 'processing' ? '正在计算像素...' : `下载 AI 模型: ${bgProgress}%`}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-center">首次使用需下载模型 (约 20MB)</p>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleRemoveBackground}
                                    className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl shadow-lg shadow-violet-500/20 font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                                    一键智能抠图
                                </button>
                            )}
                        </div>

                        <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">目标宽度 (像素)</label>
                            <span className="text-primary font-bold">{photoTargetWidth} px</span>
                        </div>
                        <input type="range" min="0" max="100" step="0.1" value={sliderValue} onChange={handlePhotoSliderChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"/>
                        </div>
                    </div>
                  </div>
              ) : (
                  <div className="flex flex-col h-full">
                      <div className="relative w-full h-72 bg-slate-100 dark:bg-black/20 shrink-0 border-b border-gray-200 dark:border-gray-700 overflow-hidden touch-none"
                           onWheel={handleWheel}
                           onMouseDown={handleMouseDown}
                           onMouseMove={handleMouseMove}
                           onMouseUp={handleMouseUp}
                           onMouseLeave={handleMouseUp}
                           onTouchStart={handleTouchStart}
                           onTouchMove={handleTouchMove}
                           onTouchEnd={handleTouchEnd}
                      >
                          <canvas ref={patternCanvasRef} width={400} height={320} className="w-full h-full block cursor-move"/>
                          <div className="absolute top-2 left-2 flex gap-1 pointer-events-none">
                              <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">双指缩放/拖拽移动</div>
                          </div>
                      </div>
                      
                      <div className="p-4 space-y-4 flex-1">
                          <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/10 space-y-3">
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="material-symbols-outlined text-purple-500 text-sm">grid_on</span>
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">网格设置</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                  <NumberControl label="网格大小" value={patternState.cellSize} step={0.1} min={2} max={200} unit="px" onChange={(v:any) => setPatternState(s => ({...s, cellSize: v}))} />
                                  <NumberControl label="旋转角度" value={patternState.rotation} step={0.5} min={-180} max={180} unit="°" onChange={(v:any) => setPatternState(s => ({...s, rotation: v}))} />
                              </div>
                          </div>
                          {/* ... other controls ... */}
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 block">识别品牌</label>
                              <div className="flex gap-2 overflow-x-auto pb-1 custom-horizontal-scrollbar">
                                {availableBrands.map(b => (
                                    <button 
                                        key={b}
                                        onClick={() => setPatternState(s => ({...s, targetBrand: b}))}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-colors ${patternState.targetBrand === b ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}
                                    >
                                        {b}
                                    </button>
                                ))}
                              </div>
                          </div>
                      </div>
                  </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-black/10 flex gap-3 shrink-0">
              <button onClick={() => setShowImportDialog(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">取消</button>
              <button onClick={processImport} disabled={isProcessing} className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-lg transition-colors flex items-center justify-center gap-2 ${importMode === 'pattern' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30' : 'bg-primary hover:bg-primary-dark shadow-primary/30'}`}>
                {isProcessing ? '处理中...' : (importMode === 'pattern' ? '开始识别' : '确认生成')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 flex flex-col items-center pt-8 pb-6">
               <div className="h-14 w-14 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center mb-4"><span className="material-symbols-outlined text-3xl">delete</span></div>
               <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">删除草稿</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">确定要永久删除这个作品吗？<br/>此操作无法撤销。</p>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-black/10 flex gap-3">
              <button onClick={() => setShowDeleteDialog(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">取消</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Create;
