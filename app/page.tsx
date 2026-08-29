'use client';

import Image from 'next/image';
import { Heart, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

const gifts = [
  { id: 'cocoa', icon: '☕', label: 'Какао', message: 'Тёплая кружка теперь рядом.' },
  { id: 'blanket', icon: '🧣', label: 'Плед', message: 'Теперь ему чуточку теплее.' },
  { id: 'flower', icon: '🌼', label: 'Цветок', message: 'Он осторожно понюхал цветок.' },
  { id: 'box', icon: '📦', label: 'Коробка', message: 'Коробка принята. Это серьёзное дело.' },
  { id: 'sock', icon: '🧦', label: 'Носочек', message: 'Он положил носочек рядом с лапой.' },
  { id: 'duck', icon: '🐥', label: 'Уточка', message: 'Уточка будет сторожить тишину.' },
] as const;

const petMessages = [
  'Он тихонько придвинулся поближе.',
  'Можно ещё немножко.',
  'Он всё ещё грустит. Но уже не один.',
  'Пушистик прикрыл глаза.',
];

type Burst = { id: number; x: number; y: number; symbol: 'heart' | 'sparkle' };
type PlacedGift = { id: number; icon: string; slot: number };

export default function Home() {
  const [message, setMessage] = useState('Можно просто побыть рядом.');
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [placedGifts, setPlacedGifts] = useState<PlacedGift[]>([]);
  const pointer = useRef({ active: false, x: 0, y: 0, distance: 0 });
  const sequence = useRef(0);
  const petIndex = useRef(0);

  function makeBurst(x: number, y: number) {
    const id = ++sequence.current;
    setBursts((items) => [...items.slice(-8), { id, x, y, symbol: id % 3 ? 'heart' : 'sparkle' }]);
    window.setTimeout(() => setBursts((items) => items.filter((item) => item.id !== id)), 1050);
  }

  function respondToPet(x: number, y: number) {
    makeBurst(x, y);
    petIndex.current += 1;
    if (petIndex.current % 3 === 1) {
      setMessage(petMessages[Math.floor(petIndex.current / 3) % petMessages.length]);
      navigator.vibrate?.(7);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { active: true, x: event.clientX, y: event.clientY, distance: 0 };
    const rect = event.currentTarget.getBoundingClientRect();
    respondToPet(event.clientX - rect.left, event.clientY - rect.top);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!pointer.current.active) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current.distance += Math.hypot(dx, dy);
    pointer.current.x = event.clientX;
    pointer.current.y = event.clientY;
    if (pointer.current.distance < 22) return;
    pointer.current.distance = 0;
    const rect = event.currentTarget.getBoundingClientRect();
    respondToPet(event.clientX - rect.left, event.clientY - rect.top);
  }

  function giveGift(gift: (typeof gifts)[number]) {
    const id = ++sequence.current;
    setPlacedGifts((items) => [...items.slice(-5), { id, icon: gift.icon, slot: id % 6 }]);
    setMessage(gift.message);
    navigator.vibrate?.([8, 24, 8]);
  }

  return (
    <main className="comfort-room">
      <header className="room-header">
        <div><p className="eyebrow">Пушистое место</p><h1>Здесь не нужно быть в порядке</h1></div>
        <span className="now-pill"><span /> тихий вечер</span>
      </header>

      <section className="friend-space" aria-label="Грустный пушистик">
        <div className="glow" aria-hidden="true" />
        <div className="pet-hint"><Sparkles aria-hidden="true" /> проведи пальцем по шёрстке</div>
        <div className="friend-stage">
          {placedGifts.map((gift) => <span key={gift.id} className={`placed-gift gift-slot-${gift.slot}`} aria-hidden="true">{gift.icon}</span>)}
          <button
            className="fluffy-button"
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { pointer.current.active = false; }}
            onPointerCancel={() => { pointer.current.active = false; }}
            aria-label="Погладить пушистика"
          >
            <Image src="/fluffy-character.png" alt="Маленький грустный кремовый пушистик" width={1254} height={1254} priority draggable={false} />
            {bursts.map((burst) => burst.symbol === 'heart'
              ? <Heart key={burst.id} className="pet-burst" style={{ left: burst.x, top: burst.y }} fill="currentColor" aria-hidden="true" />
              : <Sparkles key={burst.id} className="pet-burst sparkle-burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true" />)}
          </button>
        </div>
        <p className="soft-message" aria-live="polite">{message}</p>
      </section>

      <section className="gift-dock" aria-label="Подарки для пушистика">
        <div className="dock-copy"><p>Что ему принести?</p><span>Можно сколько угодно</span></div>
        <div className="gift-row">
          {gifts.map((gift) => (
            <Button key={gift.id} className="gift-button" variant="secondary" onClick={() => giveGift(gift)} aria-label={`Подарить: ${gift.label}`}>
              <span aria-hidden="true">{gift.icon}</span><small>{gift.label}</small>
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}
