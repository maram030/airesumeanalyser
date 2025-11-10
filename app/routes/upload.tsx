import React, {type FormEvent, useState} from 'react';
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {useNavigate} from "react-router";
import {convertPathToPattern} from "tinyglobby";
import { convertPdfToImage } from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";

const Upload = () => {
    const {auth,isLoading,fs,ai,kv}=usePuterStore();
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing,setIsProcessing] = useState(false);
    const [statusText,setStatusText] = useState('');
    const handleAnalyze=async({companyName,jobTitle,jobDescription,file}:{companyName:string,jobTitle:string,jobDescription:string,file:File,})=> {
        setIsProcessing(true);
        setStatusText("uploading...");
        const uploadedFile = await fs.upload([file]);
        if (!uploadedFile) return setStatusText("Error : No file uploaded");
        setStatusText("converting to image...");
        const imageFile = await convertPdfToImage(file);
        if (!imageFile.file) return setStatusText("Error : No file converted");
        setStatusText("uploading the image...");
        const uploadedImage = await fs.upload([imageFile.file]);
        if (!uploadedImage) return setStatusText("Error : No image uploaded");
        setStatusText("preparing data...");
        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName, jobTitle, jobDescription,
            feedback: '',
        }
        await kv.set(`resume:${uuid}`, JSON.stringify(data));
        setStatusText("analysing data...");
        const feedback = await ai.feedback(
            uploadedFile.path,
            prepareInstructions({jobTitle, jobDescription,AIResponseFormat: "json"})
        )
        if (!feedback) return setStatusText("Error : No feedback");
        const feedbackText = typeof feedback.message.content === 'string'
            ? feedback.message.content
            : feedback.message.content[0].text;
        data.feedback = JSON.parse(feedbackText);
        await  kv.set(`resume:${uuid}`, JSON.stringify(data));
        setStatusText("Analyzing complete,redirecting...");
        console.log(data);
    }
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if (!form) return;
        const formData = new FormData(form);
        const companyName = formData.get('companyName') as string;
        const jobTitle = formData.get('jobTitle') as string;
        const jobDescription = formData.get('jobDescription') as string;
        if (!file) return;
        handleAnalyze({companyName, jobTitle, jobDescription, file}).then(() => {
        });
    }
    const handleFileSelect  = (file: File | null) => {
        setFile(file);
    };

    return (
        <main className="bg-url('/images/bg-main.svg')] bg-cover">
            <Navbar/>
            <section className="main-section">
               <div className="page-heading py-16">
                   <h1>Smart feedback for your dream job</h1>
                   {isProcessing ? (
                       <>
                           <h2>{statusText}</h2>
                           <img src="/images/resume-scan.gif" alt="scan" className="w-full" />
                       </>
                   ):(
                       <h2>Drop your resume for an ATS score and improvement tips</h2>
                   )}{
                       !isProcessing  && (
                           <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                                <div className="form-div">
                                    <label htmlFor="company-name">Company Name</label>
                                    <input type="text" name="company-name" placeholder="Company Name" id="company-name"  />
                                </div>
                               <div className="form-div">
                                   <label htmlFor="job-title">Job Title</label>
                                   <input type="text" name="job-title" placeholder="Job Title" id="job-title"  />
                               </div>
                               <div className="form-div">
                                   <label htmlFor="job-description">Job Description</label>
                                   <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                               </div>
                               <div className="form-div">
                                   <label htmlFor="uploader">Upload Resume</label>
                                   <FileUploader onFileSelect={handleFileSelect}/>
                               </div>
                               <button className="primary-button" type={"submit"}>Analyze Resume</button>
                           </form>
                   )}
               </div>
            </section>
        </main>
    );
};

export default Upload;
