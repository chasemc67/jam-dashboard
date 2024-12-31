/* Prompt
Make me a landing page for my website using ShadCN and react. 

In the middle of the landing page there should be a Title and description, then a dropdown, divider, and textbox beneath it. Sort of like this:

<PageStart>
===========

Title
Desc

<Dropdown>
 ----- or -----
<Textbox> <confirm button>

==========
</PageStart>

When you make a selection in the dropdown, or click the confirm button, the title and desc should fade out, and the Dropdown and Textbox should animate up to the top of the page, and share the same line. so it looks like this:

<PageStart>
===========
<Dropdown> or <Textbox> <confirm button>

==========
</PageStart>
*/

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const LandingPage = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedOption, setSelectedOption] = useState('');
  const [inputText, setInputText] = useState('');
  const [isTextVisible, setIsTextVisible] = useState(true);

  const handleSelect = (value: string) => {
    setSelectedOption(value);
    startTransition();
  };

  const handleConfirm = () => {
    if (inputText.trim()) {
      startTransition();
    }
  };

  const startTransition = () => {
    setIsTextVisible(false);
    setTimeout(() => {
      setIsExpanded(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <motion.div
        className={`w-full transition-all duration-800 ${
          isExpanded ? 'min-h-screen flex items-center' : 'pt-4'
        }`}
      >
        <div className="w-full max-w-lg mx-auto px-4">
          <AnimatePresence>
            {isTextVisible && (
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.6, ease: 'easeOut' },
                }}
              >
                <motion.h1 className="text-4xl font-bold mb-4">
                  Welcome to Our Platform
                </motion.h1>
                <motion.p className="text-muted-foreground mb-8">
                  Choose from the dropdown or enter your own text to get started
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="flex flex-col gap-4 items-center"
            animate={{
              flexDirection: isExpanded ? 'column' : 'row',
              y: isExpanded ? 0 : -20,
            }}
            transition={{
              duration: 0.8,
              ease: 'easeInOut',
              delay: isExpanded ? 0 : 0.3,
            }}
          >
            <motion.div
              animate={{ width: isExpanded ? '100%' : '12rem' }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              <Select onValueChange={handleSelect} value={selectedOption}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>

            {isExpanded && <Separator className="my-4 w-full" decorative />}

            <motion.div
              className="flex gap-2"
              animate={{
                width: isExpanded ? '100%' : 'auto',
                height: 'auto',
              }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              <Input
                type="text"
                placeholder="Enter text..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleConfirm}>Confirm</Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
