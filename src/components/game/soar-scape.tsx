"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Keyboard, Mouse, Smartphone, Instagram } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";


// Game constants
const BIRD_WIDTH = 55;
const BIRD_HEIGHT = 55;
const PIPE_WIDTH = 80;
const PIPE_GAP_PERCENT = 0.28; // 28% of canvas height
const GRAVITY = 0.3;
const JUMP_STRENGTH = -7;
const PIPE_SPEED = -2.5;
const PIPE_SPAWN_INTERVAL = 120; // in frames
const COIN_SIZE = 30;


interface Bird {
  x: number;
  y: number;
  velocityY: number;
  rotation: number;
}

interface Pipe {
  x: number;
  topPipeHeight: number;
  passed?: boolean;
}

interface Coin {
    x: number;
    y: number;
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
  type: 'white' | 'dark';
}

interface Tree {
  x: number;
  size: number;
  type: number;
}

type GameState = 'policy' | 'idle' | 'playing' | 'over';

export function SoarScapeGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameOverBirdCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gameOverAudioRef = useRef<HTMLAudioElement | null>(null);
  const passPipeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('policy');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  const dimensionsRef = useRef({ width: 480, height: 640 });
  const birdRef = useRef<Bird>({ x: dimensionsRef.current.width / 4, y: dimensionsRef.current.height / 2, velocityY: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const treesRef = useRef<Tree[]>([]);
  const frameCountRef = useRef(0);
  const colorsRef = useRef({ primary: '', accent: '', background: '', foreground: '' });
  
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const drawBird = useCallback((ctx: CanvasRenderingContext2D) => {
    const bird = birdRef.current;
    const turbanRed = '#d92525';
    const turbanDark = '#a61c1c';
    const skin = '#f2c38f';
    const beard = '#b0b0b0';
    const mustache = '#8e8e8e';
    const eyes = '#3e6bff';
    const black = '#000000';

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation * Math.PI / 180);
    
    // Scale the bird
    const scale = BIRD_WIDTH / 40; // Original width was 40
    ctx.scale(scale, scale);
    ctx.translate(-20, -20); // Center the original 40x40 bird

    // Turban
    ctx.fillStyle = turbanRed;
    ctx.fillRect(4, 0, 32, 16);
    ctx.fillRect(0, 4, 40, 8);
    ctx.fillStyle = turbanDark;
    ctx.fillRect(14, 4, 12, 12);


    // Face
    ctx.fillStyle = skin;
    ctx.fillRect(8, 16, 24, 12);

    // Beard
    ctx.fillStyle = beard;
    ctx.fillRect(8, 28, 24, 8);
    ctx.fillRect(4, 24, 32, 4);

    // Eyes
    ctx.fillStyle = eyes;
    ctx.fillRect(12, 20, 6, 6);
    ctx.fillRect(22, 20, 6, 6);
    ctx.fillStyle = black;
    ctx.fillRect(14, 22, 2, 2);
    ctx.fillRect(24, 22, 2, 2);

    // Mustache
    ctx.fillStyle = mustache;
    ctx.fillRect(10, 26, 20, 2);
    ctx.fillRect(6, 24, 4, 2);
    ctx.fillRect(30, 24, 4, 2);
    
    ctx.restore();
  }, []);

  const preRenderBackground = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    const p = (size: number) => Math.floor(size); // pixelated size
    
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    
    if (!bgCtx) return;
    bgCtx.imageSmoothingEnabled = false;

    // Sky with texture
    const skyGradient = bgCtx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#87CEEB'); // Light Sky Blue
    skyGradient.addColorStop(1, colorsRef.current.background);
    bgCtx.fillStyle = skyGradient;
    bgCtx.fillRect(0, 0, width, height);

    // Add subtle texture to sky
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8; // Only in the upper 80%
        const alpha = Math.random() * 0.05;
        bgCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        bgCtx.fillRect(p(x), p(y), 2, 2);
    }
    
    // Land with texture
    const landHeight = 80;
    const groundY = height - landHeight;
    bgCtx.fillStyle = '#A0522D'; // Sienna
    bgCtx.fillRect(0, groundY, width, landHeight);
    
    for (let i = 0; i < width; i += 4) {
        for (let j = groundY; j < height; j += 4) {
            const alpha = Math.random() * 0.1;
            bgCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            bgCtx.fillRect(i, j, 4, 4);
        }
    }
    bgCtx.fillStyle = '#228B22'; // ForestGreen
    bgCtx.fillRect(0, groundY, width, 5);

    backgroundCanvasRef.current = bgCanvas;
  }, []);

  useEffect(() => {
    const policyAccepted = localStorage.getItem('dashmeshflap_policy_accepted');
    if (policyAccepted) {
      setGameState('idle');
    }

    const savedHighScore = localStorage.getItem('dashmeshflap_highscore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
    const styles = getComputedStyle(document.documentElement);
    colorsRef.current = {
      primary: `hsl(${styles.getPropertyValue('--primary')})`,
      accent: `hsl(${styles.getPropertyValue('--accent')})`,
      background: `hsl(${styles.getPropertyValue('--background')})`,
      foreground: `hsl(${styles.getPropertyValue('--foreground')})`,
    };
    
    // This effect runs only on the client, so `new Audio` is safe here.
    if (audioRef.current) {
        audioRef.current.volume = 0.3;
    }
    if (!gameOverAudioRef.current) {
        gameOverAudioRef.current = new Audio('/game-over.mp3');
        gameOverAudioRef.current.volume = 1.0;
    }
    if (!passPipeAudioRef.current) {
        passPipeAudioRef.current = new Audio('/effect.mp3');
        passPipeAudioRef.current.volume = 1.0;
    }

    // Set initial mute state from local storage or default to false (music on)
    const savedMuteState = localStorage.getItem('dashmeshflap_muted');
    const initialMute = savedMuteState ? JSON.parse(savedMuteState) : false;
    setIsMuted(initialMute);
    
    preRenderBackground();
  }, [preRenderBackground]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
        if (audioRef.current.loop) { // Ensure loop is set correctly
          audioRef.current.loop = true;
        }
    }
    if (gameOverAudioRef.current) {
        gameOverAudioRef.current.muted = isMuted;
    }
    if (passPipeAudioRef.current) {
        passPipeAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('dashmeshflap_highscore', score.toString());
    }
  }, [score, highScore]);

    useEffect(() => {
    if (gameState === 'over') {
        if (gameOverBirdCanvasRef.current) {
            const canvas = gameOverBirdCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Temporarily modify bird state for drawing
                const originalBird = { ...birdRef.current };
                birdRef.current.x = canvas.width / 2;
                birdRef.current.y = canvas.height / 2;
                birdRef.current.rotation = 0;
                drawBird(ctx);
                // Restore original bird state
                birdRef.current = originalBird;
            }
        }
        
        // Stop background music and play game over sound once
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (gameOverAudioRef.current && !isMuted) {
            gameOverAudioRef.current.play().catch(e => console.error("Game over sound failed", e));
        }
    }
  }, [gameState, drawBird, isMuted]);

  
  const getCanvasAndContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { ctx: null };
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }
    return { ctx };
  }, []);

  const resetGame = useCallback(() => {
    const {width, height} = dimensionsRef.current;
    birdRef.current = {
      x: width / 4,
      y: height / 2,
      velocityY: 0,
      rotation: 0
    };
    pipesRef.current = [];
    coinsRef.current = [];
    cloudsRef.current = [];
    treesRef.current = [];
    setScore(0);
    frameCountRef.current = 0;
  }, []);
  
  const playMusic = useCallback(() => {
    if (audioRef.current && !isMuted) {
      audioRef.current.loop = true;
      audioRef.current.play().catch(error => {
        // Autoplay was prevented. User interaction is needed.
        // This is fine as the music will play on the first jump.
      });
    }
  }, [isMuted]);

  const jump = useCallback(() => {
    if (gameState === 'playing') {
      birdRef.current.velocityY = JUMP_STRENGTH;
      playMusic();
    } else if (gameState === 'idle') {
      resetGame();
      setGameState('playing');
      birdRef.current.velocityY = JUMP_STRENGTH;
      playMusic();
    }
  }, [gameState, resetGame, playMusic]);

  const handleRestart = () => {
    resetGame();
    setGameState('playing');
    playMusic();
  };

  const handleAcceptPolicy = () => {
    localStorage.setItem('dashmeshflap_policy_accepted', 'true');
    setGameState('idle');
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (!newMutedState && gameState === 'playing') {
        audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
    } else {
        audioRef.current?.pause();
    }
    localStorage.setItem('dashmeshflap_muted', JSON.stringify(newMutedState));
  };

  const drawPipes = useCallback((ctx: CanvasRenderingContext2D) => {
    const pipeHeadHeight = 40;
    const {height} = dimensionsRef.current;
    const PIPE_GAP = height * PIPE_GAP_PERCENT;
    
    const mainRed = '#ff0000';
    const highlightRed = '#ff6b6b';
    const shadowRed = '#c40000';
    const darkRed = '#8b0000';
    const black = '#000000';

    pipesRef.current.forEach(pipe => {
      // Draw Top Pipe
      const topPipeBodyHeight = pipe.topPipeHeight - pipeHeadHeight;
      // Body
      ctx.fillStyle = mainRed;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topPipeBodyHeight);
      ctx.fillStyle = highlightRed;
      ctx.fillRect(pipe.x + 8, 0, 16, topPipeBodyHeight);
      // Head
      ctx.fillStyle = mainRed;
      ctx.fillRect(pipe.x - 8, topPipeBodyHeight, PIPE_WIDTH + 16, pipeHeadHeight);
      ctx.fillStyle = highlightRed;
      ctx.fillRect(pipe.x, topPipeBodyHeight, 16, pipeHeadHeight);
      ctx.fillStyle = shadowRed;
      ctx.fillRect(pipe.x - 8, topPipeBodyHeight + pipeHeadHeight - 8, PIPE_WIDTH + 16, 8);
      // Opening
      ctx.fillStyle = darkRed;
      ctx.fillRect(pipe.x, topPipeBodyHeight + 8, PIPE_WIDTH, 16);
      ctx.fillStyle = black;
      ctx.fillRect(pipe.x + 8, topPipeBodyHeight + 8, PIPE_WIDTH - 16, 8);
      
      
      const bottomPipeY = pipe.topPipeHeight + PIPE_GAP;
      // Draw Bottom Pipe
      const bottomPipeBodyHeight = height - bottomPipeY - pipeHeadHeight;
      // Head
      ctx.fillStyle = mainRed;
      ctx.fillRect(pipe.x - 8, bottomPipeY, PIPE_WIDTH + 16, pipeHeadHeight);
      ctx.fillStyle = highlightRed;
      ctx.fillRect(pipe.x, bottomPipeY, 16, pipeHeadHeight);
      ctx.fillStyle = shadowRed;
      ctx.fillRect(pipe.x - 8, bottomPipeY + 8, PIPE_WIDTH + 16, 8);
      // Opening
      ctx.fillStyle = darkRed;
      ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, 16);
      ctx.fillStyle = black;
      ctx.fillRect(pipe.x + 8, bottomPipeY + 8, PIPE_WIDTH - 16, 8);
      // Body
      ctx.fillStyle = mainRed;
      ctx.fillRect(pipe.x, bottomPipeY + pipeHeadHeight, PIPE_WIDTH, bottomPipeBodyHeight);
      ctx.fillStyle = highlightRed;
      ctx.fillRect(pipe.x + 8, bottomPipeY + pipeHeadHeight, 16, bottomPipeBodyHeight);
    });
  }, []);

  const drawCoins = useCallback((ctx: CanvasRenderingContext2D) => {
    coinsRef.current.forEach(coin => {
        ctx.save();
        const scale = COIN_SIZE / 20;
        ctx.translate(coin.x, coin.y);
        ctx.scale(scale, scale);
        ctx.translate(-10, -10);

        const colors = {
          dark_gold: '#b1560f',
          gold: '#f3a614',
          light_gold: '#ffd52c',
          dark_brown: '#4e2a01',
          brown: '#794c1d',
          light_brown: '#b47434',
        }
        const p = (x:number, y:number, w:number, h:number, color:string) => {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
        }

        p(7, 0, 6, 1, colors.dark_brown);
        p(6, 1, 8, 1, colors.dark_brown);
        p(5, 2, 10, 1, colors.dark_brown);
        p(4, 3, 12, 1, colors.dark_brown);
        p(3, 4, 14, 1, colors.dark_brown);
        p(3, 5, 1, 10, colors.dark_brown);
        p(2, 6, 1, 8, colors.dark_brown);
        p(1, 7, 1, 6, colors.dark_brown);
        p(0, 8, 1, 4, colors.dark_brown);
        p(1, 13, 1, 1, colors.dark_brown);
        p(2, 14, 1, 2, colors.dark_brown);
        p(3, 15, 1, 1, colors.dark_brown);
        p(4, 16, 12, 1, colors.dark_brown);
        p(5, 17, 10, 1, colors.dark_brown);
        p(6, 18, 8, 1, colors.dark_brown);
        p(7, 19, 6, 1, colors.dark_brown);
        p(16, 4, 1, 12, colors.dark_brown);
        p(17, 5, 1, 10, colors.dark_brown);
        p(18, 6, 1, 8, colors.dark_brown);
        p(19, 8, 1, 4, colors.dark_brown);
        
        p(7, 1, 6, 1, colors.brown);
        p(6, 2, 1, 1, colors.brown);
        p(13, 2, 1, 1, colors.brown);
        p(5, 3, 1, 1, colors.brown);
        p(14, 3, 1, 1, colors.brown);
        p(4, 4, 1, 12, colors.brown);
        p(15, 4, 1, 12, colors.brown);
        p(5, 16, 1, 1, colors.brown);
        p(14, 16, 1, 1, colors.brown);
        p(6, 17, 1, 1, colors.brown);
        p(13, 17, 1, 1, colors.brown);
        p(7, 18, 6, 1, colors.brown);
        
        p(8, 1, 4, 1, colors.dark_gold);
        p(7, 2, 6, 1, colors.dark_gold);
        p(6, 3, 8, 1, colors.dark_gold);
        p(5, 4, 10, 1, colors.dark_gold);
        p(5, 5, 10, 10, colors.dark_gold);
        p(6, 15, 8, 1, colors.dark_gold);
        p(7, 16, 6, 1, colors.dark_gold);
        p(8, 17, 4, 1, colors.dark_gold);
        
        p(8, 2, 4, 1, colors.gold);
        p(7, 3, 6, 1, colors.gold);
        p(6, 4, 8, 1, colors.gold);
        p(6, 5, 8, 9, colors.gold);
        p(7, 14, 6, 1, colors.gold);
        p(8, 15, 4, 1, colors.gold);
        p(9, 16, 2, 1, colors.gold);

        p(9, 3, 2, 1, colors.light_gold);
        p(8, 4, 4, 1, colors.light_gold);
        p(7, 5, 6, 1, colors.light_gold);
        p(7, 6, 6, 7, colors.light_gold);
        p(8, 13, 4, 1, colors.light_gold);
        p(9, 14, 2, 1, colors.light_gold);

        p(7, 8, 1, 4, colors.brown);
        p(8, 7, 3, 1, colors.brown);
        p(11, 8, 1, 4, colors.brown);
        p(8, 11, 3, 1, colors.brown);

        ctx.restore();
    });
  }, []);
  
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current;
    const p = (size: number) => Math.floor(size);

    if (backgroundCanvasRef.current) {
        ctx.drawImage(backgroundCanvasRef.current, 0, 0, width, height);
    }

    // Clouds
    cloudsRef.current.forEach(cloud => {
        ctx.fillStyle = cloud.type === 'white' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.1)';
        const x = p(cloud.x);
        const y = p(cloud.y);
        const s = p(cloud.size);
        ctx.fillRect(x, y, s, p(s / 3));
        ctx.fillRect(x - p(s / 4), y + p(s / 3), p(s * 1.5), p(s / 3));
        ctx.fillRect(x + p(s / 8), y + p(s / 3) * 2, p(s * 0.8), p(s / 3));
    });

    // Trees
    const groundY = height - 80;
    treesRef.current.forEach(tree => {
        const x = p(tree.x);
        const s = p(tree.size);
        const treeTopY = groundY - s;

        const trunkWidth = p(s / 5);
        const trunkHeight = p(s / 3);
        const trunkX = x + p(s / 2) - p(trunkWidth / 2);
        
        // Trunk
        ctx.fillStyle = '#654321'; // Dark Brown
        ctx.fillRect(trunkX, treeTopY + s - trunkHeight, trunkWidth, trunkHeight);

        // Leaves
        ctx.fillStyle = '#006400'; // Dark Green
        if (tree.type === 0) { // Pine tree
            ctx.fillRect(x, treeTopY + p(s * 0.6), s, p(s * 0.4));
            ctx.fillRect(x + p(s * 0.1), treeTopY + p(s * 0.3), p(s * 0.8), p(s * 0.4));
            ctx.fillRect(x + p(s * 0.2), treeTopY, p(s * 0.6), p(s * 0.4));
        } else { // Round tree
            ctx.fillRect(x, treeTopY + p(s*0.2), s, p(s*0.8));
            ctx.fillRect(x + p(s*0.2), treeTopY, p(s*0.6), s);
        }
        
        // Leaf highlights
        ctx.fillStyle = '#228B22'; // Forest Green
         if (tree.type === 0) {
            ctx.fillRect(x + p(s*0.1), treeTopY + p(s*0.6), p(s*0.8), p(s*0.1));
            ctx.fillRect(x + p(s*0.2), treeTopY + p(s*0.3), p(s*0.6), p(s*0.1));
            ctx.fillRect(x + p(s*0.3), treeTopY, p(s*0.4), p(s*0.1));
         } else {
            ctx.fillRect(x + p(s*0.1), treeTopY + p(s*0.1), p(s*0.8), p(s*0.2));
            ctx.fillRect(x + p(s*0.3), treeTopY + p(s*0.4), p(s*0.4), p(s*0.2));
         }
    });
  }, []);

  const updateCanvasDimensions = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container && canvas) {
      const { width, height } = container.getBoundingClientRect();
      dimensionsRef.current = { width, height };
      canvas.width = width;
      canvas.height = height;
      preRenderBackground();
    }
  }, [preRenderBackground]);

  useEffect(() => {
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [updateCanvasDimensions]);

  useEffect(() => {
    const { ctx } = getCanvasAndContext();
    if (!ctx) return;
    let animationFrameId: number;
    const {width, height} = dimensionsRef.current;
    const PIPE_GAP = height * PIPE_GAP_PERCENT;

    const gameLoop = () => {
      if (gameState === 'playing') {
        // Physics update
        birdRef.current.velocityY += GRAVITY;
        birdRef.current.y += birdRef.current.velocityY;
        birdRef.current.rotation = Math.min(Math.max(-20, birdRef.current.velocityY * 5), 90);

        // Pipe & Coin management
        frameCountRef.current++;
        if (frameCountRef.current % PIPE_SPAWN_INTERVAL === 0) {
          const minPipeHeight = 80;
          const maxPipeHeight = height - PIPE_GAP - 80;
          const topPipeHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
          pipesRef.current.push({ x: width, topPipeHeight, passed: false });

          // Spawn a coin in the gap
          const coinY = topPipeHeight + (PIPE_GAP / 2);
          coinsRef.current.push({ x: width + (PIPE_WIDTH / 2), y: coinY });
        }
        
        // Coin collision
        coinsRef.current = coinsRef.current.filter(coin => {
            const distance = Math.sqrt((birdRef.current.x - coin.x) ** 2 + (birdRef.current.y - coin.y) ** 2);
            if (distance < BIRD_WIDTH / 2 + COIN_SIZE / 2) {
                setScore(s => s + 100);
                toast({
                    title: "Fees Increased!",
                    description: "100rs have been added.",
                });
                return false; // Remove the coin
            }
            return true; // Keep the coin
        });

        pipesRef.current.forEach(pipe => { 
            pipe.x += PIPE_SPEED; 
            if (!pipe.passed && pipe.x + PIPE_WIDTH < birdRef.current.x) {
                pipe.passed = true;
                // setScore(s => s + 1); // Removed scoring for passing pipe
                if (passPipeAudioRef.current && !isMuted) {
                    passPipeAudioRef.current.currentTime = 0;
                    passPipeAudioRef.current.play().catch(e => console.error("Pass pipe sound failed", e));
                }
            }
        });
        coinsRef.current.forEach(coin => { coin.x += PIPE_SPEED; });
        pipesRef.current = pipesRef.current.filter(pipe => pipe.x + PIPE_WIDTH + 16 > 0);
        coinsRef.current = coinsRef.current.filter(coin => coin.x + COIN_SIZE > 0);


        // Background scenery update
        if (Math.random() < 0.01) {
            cloudsRef.current.push({
                x: width,
                y: Math.random() * height * 0.5,
                size: Math.random() * 40 + 30,
                speed: -(Math.random() * 0.5 + 0.2),
                type: 'white'
            });
        }
         if (Math.random() < 0.005) {
            cloudsRef.current.push({
                x: width,
                y: Math.random() * height * 0.6,
                size: Math.random() * 50 + 40,
                speed: -(Math.random() * 0.2 + 0.1),
                type: 'dark'
            });
        }
        cloudsRef.current.forEach(cloud => { cloud.x += cloud.speed });
        cloudsRef.current = cloudsRef.current.filter(cloud => cloud.x + cloud.size * 2 > 0);

        if (Math.random() < 0.02) { // Chance to spawn a tree
            treesRef.current.push({
                x: width,
                size: Math.random() * 30 + 30, // 30px to 60px tall
                type: Math.random() > 0.5 ? 0 : 1,
            });
        }
        treesRef.current.forEach(tree => { tree.x += PIPE_SPEED * 0.5 }); // Slower parallax for trees
        treesRef.current = treesRef.current.filter(tree => tree.x + tree.size > 0);


        // Collision detection
        const bird = birdRef.current;
        const groundY = height - 80; // Land height
        if (bird.y > groundY - BIRD_HEIGHT / 2 || bird.y < -BIRD_HEIGHT / 2) {
          setGameState('over');
        }

        const birdRect = { left: bird.x - BIRD_WIDTH / 2, right: bird.x + BIRD_WIDTH / 2, top: bird.y - BIRD_HEIGHT / 2, bottom: bird.y + BIRD_HEIGHT / 2 };
        
        for (const pipe of pipesRef.current) {
          const pipeTopRect = { left: pipe.x, right: pipe.x + PIPE_WIDTH, top: 0, bottom: pipe.topPipeHeight };
          const pipeBottomRect = { left: pipe.x, right: pipe.x + PIPE_WIDTH, top: pipe.topPipeHeight + PIPE_GAP, bottom: height };
          
          if ( (birdRect.right > pipeTopRect.left && birdRect.left < pipeTopRect.right && birdRect.top < pipeTopRect.bottom) ||
               (birdRect.right > pipeBottomRect.left && birdRect.left < pipeBottomRect.right && birdRect.bottom > pipeBottomRect.top) ) 
          {
            setGameState('over');
          }
        }
      }
      
      // Drawing
      ctx.clearRect(0, 0, width, height);
      drawBackground(ctx);
      drawPipes(ctx);
      drawCoins(ctx);
      drawBird(ctx);
      
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, getCanvasAndContext, setScore, drawPipes, drawBird, drawBackground, drawCoins, toast, isMuted]);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      // Prevent jump if a dialog is open
      if (isSettingsOpen || isHelpOpen || gameState === 'policy') return;

      e.preventDefault();
      jump();
    };

    const canvas = canvasRef.current;
    window.addEventListener('keydown', handleEvent);
    canvas?.addEventListener('mousedown', handleEvent);
    canvas?.addEventListener('touchstart', handleEvent);

    return () => {
      window.removeEventListener('keydown', handleEvent);
      canvas?.removeEventListener('mousedown', handleEvent);
      canvas?.removeEventListener('touchstart', handleEvent);
    };
  }, [jump, isSettingsOpen, isHelpOpen, gameState]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <audio ref={audioRef} src="/bg.mp3" />
      <h1 className="text-5xl font-bold text-foreground sr-only">Dashmesh Flap</h1>
      <div className="relative w-full h-full cursor-pointer">
        <canvas ref={canvasRef} className="w-full h-full" />

        <div className="absolute top-4 right-4 z-10">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="lg" className="text-foreground hover:bg-white/20 p-2 h-auto text-xl">
                Info
              </Button>
            </DialogTrigger>
            <DialogContent className="w-auto max-w-[300px] border-4">
              <DialogHeader>
                <DialogTitle>Info</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="music-switch" className="text-lg">Music</Label>
                  <Switch
                    id="music-switch"
                    checked={!isMuted}
                    onCheckedChange={toggleMute}
                  />
                </div>
                <Button onClick={() => { setIsSettingsOpen(false); setIsHelpOpen(true); }} className="font-bold border-4">
                  How to Play
                </Button>
                <Button asChild className="font-bold border-4">
                  <a href="https://instagram.com/dashmeshxd" target="_blank" rel="noopener noreferrer">
                    <Instagram className="mr-2 h-5 w-5" /> @dashmeshxd
                  </a>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>


        <div className="absolute bottom-4 left-4 z-10 text-white p-2 rounded-lg bg-black/30">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 hidden md:block" /> 
            <Mouse className="w-5 h-5 hidden md:block" /> 
            <Smartphone className="w-5 h-5 md:hidden" />
            <span className="text-sm font-bold">JUMP</span>
          </div>
        </div>

        {gameState === 'playing' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-5xl font-bold text-white" style={{ textShadow: '4px 4px 0px rgba(0,0,0,0.8)' }}>
            {score}
          </div>
        )}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30" onClick={jump}>
            <h2 className="text-3xl font-bold text-white animate-pulse" style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.8)' }}>Click to Start</h2>
          </div>
        )}
        {gameState === 'over' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Card className="w-[350px] text-center border-4 shadow-lg">
              <CardHeader>
                <CardTitle className="text-3xl">Game Over</CardTitle>
                <CardDescription>Nice flight!</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex justify-center">
                    <canvas ref={gameOverBirdCanvasRef} width={BIRD_WIDTH * 1.5} height={BIRD_HEIGHT * 1.5} />
                </div>
                <div className="text-base space-y-2">
                  <p>Total Fees Increased: <span className="font-bold text-xl">{score}rs</span></p>
                  <p>Highest Fees: <span className="font-bold text-lg">{highScore}rs</span></p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button onClick={handleRestart} className="font-bold border-4" size="lg">
                  <RotateCcw className="mr-2 h-5 w-5" /> Restart
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
        <AlertDialog open={gameState === 'policy'}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Welcome to Dashmesh Flap!</AlertDialogTitle>
              <AlertDialogDescription>
                This game is created for fun and is not intended to cause any harm or distress. By playing, you agree to enjoy the challenge and respect the spirit of the game.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleAcceptPolicy}>Accept & Play</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>How to Play Dashmesh Flap</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Your goal is to fly the character through the gaps in the pipes without hitting them.</p>
                <p>On a computer, press the <span className="font-bold">Spacebar</span> or <span className="font-bold">Click</span> the mouse to make the character jump.</p>
                <p>On a mobile device, simply <span className="font-bold">Tap</span> the screen to jump.</p>
                <p>Collect coins to increase the fees. Good luck!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setIsHelpOpen(false)}>Got it!</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
